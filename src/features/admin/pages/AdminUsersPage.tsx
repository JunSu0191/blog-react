import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import type { UserRole, UserStatus } from "@/shared/context/auth.types";
import {
  ActionDialog,
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import { formatDateTime } from "../format";
import AdminShell from "../components/AdminShell";
import AdminPagination from "../components/AdminPagination";
import SortableHeader from "../components/SortableHeader";
import {
  useAdminUsers,
  useBulkUpdateAdminUserRole,
  useBulkUpdateAdminUserStatus,
} from "../queries";
import { useAdminListParams } from "../useAdminListParams";

type BulkUserActionTarget =
  | { kind: "role"; userIds: number[]; role: UserRole }
  | { kind: "status"; userIds: number[]; status: UserStatus };

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10개" },
  { value: 20, label: "20개" },
  { value: 30, label: "30개" },
  { value: 50, label: "50개" },
];

export default function AdminUsersPage() {
  const { success, error, warn } = useToast();
  const listParams = useAdminListParams({ defaultSize: 20 });
  const usersQuery = useAdminUsers(listParams.params);
  const bulkRoleMutation = useBulkUpdateAdminUserRole();
  const bulkStatusMutation = useBulkUpdateAdminUserStatus();

  const [keywordInput, setKeywordInput] = useState(listParams.keyword);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkActionTarget, setBulkActionTarget] =
    useState<BulkUserActionTarget | null>(null);

  useEffect(() => {
    setKeywordInput(listParams.keyword);
  }, [listParams.keyword]);

  useEffect(() => {
    const visibleIds = new Set((usersQuery.data?.content || []).map((user) => user.id));
    setSelectedUserIds((previous) => previous.filter((userId) => visibleIds.has(userId)));
  }, [usersQuery.data?.content]);

  const rows = usersQuery.data?.content || [];
  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectedRows = rows.filter((row) => selectedSet.has(row.id));
  const selectedAdminIds = selectedRows
    .filter((row) => row.role === "ADMIN")
    .map((row) => row.id);
  const selectedUserRoleIds = selectedRows
    .filter((row) => row.role === "USER")
    .map((row) => row.id);
  const selectedActiveIds = selectedRows
    .filter((row) => row.status === "ACTIVE")
    .map((row) => row.id);
  const selectedSuspendedIds = selectedRows
    .filter((row) => row.status === "SUSPENDED")
    .map((row) => row.id);
  const allVisibleIds = rows.map((row) => row.id);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedSet.has(id));

  const isMutating = bulkRoleMutation.isPending || bulkStatusMutation.isPending;

  const dialogTexts = useMemo(() => {
    if (!bulkActionTarget) return { title: "", content: "", confirmText: "확인" };
    if (bulkActionTarget.kind === "role") {
      return {
        title: "사용자 권한 일괄 변경",
        content: `${bulkActionTarget.userIds.length}개 계정의 권한을 ${bulkActionTarget.role}(으)로 변경하시겠습니까?`,
        confirmText: "권한 변경",
      };
    }
    const nextStatusLabel =
      bulkActionTarget.status === "ACTIVE" ? "활성" : "정지";
    return {
      title: "사용자 상태 일괄 변경",
      content: `${bulkActionTarget.userIds.length}개 계정의 상태를 ${nextStatusLabel}(으)로 변경하시겠습니까?`,
      confirmText: "상태 변경",
    };
  }, [bulkActionTarget]);

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const toggleAllVisibleSelection = () => {
    setSelectedUserIds((previous) => {
      if (allVisibleSelected) {
        return previous.filter((userId) => !allVisibleIds.includes(userId));
      }
      return Array.from(new Set([...previous, ...allVisibleIds]));
    });
  };

  const handleConfirmBulkAction = async () => {
    if (!bulkActionTarget || bulkActionTarget.userIds.length === 0) return;
    try {
      if (bulkActionTarget.kind === "role") {
        await bulkRoleMutation.mutateAsync({
          userIds: bulkActionTarget.userIds,
          role: bulkActionTarget.role,
        });
        success(
          `${bulkActionTarget.userIds.length}개 계정 권한을 ${bulkActionTarget.role}(으)로 변경했습니다.`,
        );
      } else {
        await bulkStatusMutation.mutateAsync({
          userIds: bulkActionTarget.userIds,
          status: bulkActionTarget.status,
        });
        const label = bulkActionTarget.status === "ACTIVE" ? "활성" : "정지";
        success(`${bulkActionTarget.userIds.length}개 계정을 ${label} 처리했습니다.`);
      }
      setSelectedUserIds((previous) =>
        previous.filter((id) => !bulkActionTarget.userIds.includes(id)),
      );
      setBulkActionTarget(null);
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status?: number | string }).status
          : undefined;
      if (status === 409) {
        warn("마지막 ADMIN 계정은 USER로 변경할 수 없습니다.");
      } else {
        error(parseErrorMessage(err, "사용자 일괄 변경에 실패했습니다."));
      }
    }
  };

  return (
    <AdminShell
      title="사용자 관리"
      description="체크박스로 여러 사용자를 선택해 권한/상태를 일괄 변경할 수 있습니다."
    >
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px]">
          <form
            className="flex min-w-0 gap-2 sm:col-span-2 lg:col-span-1"
            onSubmit={(event) => {
              event.preventDefault();
              listParams.setKeyword(keywordInput);
            }}
          >
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="사용자명 또는 이름 검색"
              aria-label="사용자 검색어"
            />
            <Button type="submit" className="h-11 shrink-0" aria-label="사용자 검색">
              검색
            </Button>
          </form>
          <Select
            label="페이지 크기"
            value={String(listParams.size)}
            onValueChange={(value) => listParams.setSize(Number(value))}
            options={PAGE_SIZE_OPTIONS}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            선택됨 {selectedUserIds.length}개
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedUserRoleIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  kind: "role",
                  userIds: selectedUserRoleIds,
                  role: "ADMIN",
                })
              }
              aria-label="선택 사용자 ADMIN 권한 변경"
            >
              선택 ADMIN ({selectedUserRoleIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedAdminIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  kind: "role",
                  userIds: selectedAdminIds,
                  role: "USER",
                })
              }
              aria-label="선택 사용자 USER 권한 변경"
            >
              선택 USER ({selectedAdminIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedSuspendedIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  kind: "status",
                  userIds: selectedSuspendedIds,
                  status: "ACTIVE",
                })
              }
              aria-label="선택 사용자 활성 변경"
            >
              선택 활성 ({selectedSuspendedIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedActiveIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  kind: "status",
                  userIds: selectedActiveIds,
                  status: "SUSPENDED",
                })
              }
              aria-label="선택 사용자 정지 변경"
            >
              선택 정지 ({selectedActiveIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isMutating || selectedUserIds.length === 0}
              onClick={() => setSelectedUserIds([])}
              aria-label="선택 사용자 해제"
            >
              선택 해제
            </Button>
          </div>
        </div>

        <div className="space-y-2 md:hidden">
          {usersQuery.isLoading && (
            <div className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
              사용자 목록을 불러오는 중...
            </div>
          )}
          {!usersQuery.isLoading && usersQuery.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-center text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/25">
              {usersQuery.error.message}
            </div>
          )}
          {!usersQuery.isLoading &&
            !usersQuery.isError &&
            rows.map((user) => {
              const checked = selectedSet.has(user.id);
              return (
                <article
                  key={user.id}
                  className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUserSelection(user.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`${user.username} 사용자 선택`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {user.username}
                        </p>
                        <div className="flex gap-1">
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                            {user.role}
                          </Badge>
                          <Badge
                            className={
                              user.status === "ACTIVE"
                                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                : "bg-rose-600 text-white hover:bg-rose-600"
                            }
                          >
                            {user.status === "ACTIVE" ? "활성" : "정지"}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {user.name} · {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          {!usersQuery.isLoading &&
            !usersQuery.isError &&
            rows.length === 0 && (
              <div className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
                조회 결과가 없습니다.
              </div>
            )}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleSelection}
                    disabled={allVisibleIds.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label="현재 페이지 사용자 전체 선택"
                  />
                </TableHeader>
                <TableHeader>
                  <SortableHeader
                    label="아이디"
                    field="id"
                    currentField={listParams.sortField}
                    direction={listParams.sortDirection}
                    onToggle={listParams.toggleSort}
                  />
                </TableHeader>
                <TableHeader>
                  <SortableHeader
                    label="사용자명"
                    field="username"
                    currentField={listParams.sortField}
                    direction={listParams.sortDirection}
                    onToggle={listParams.toggleSort}
                  />
                </TableHeader>
                <TableHeader>이름</TableHeader>
                <TableHeader>권한</TableHeader>
                <TableHeader>상태</TableHeader>
                <TableHeader>
                  <SortableHeader
                    label="생성일"
                    field="createdAt"
                    currentField={listParams.sortField}
                    direction={listParams.sortDirection}
                    onToggle={listParams.toggleSort}
                  />
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    사용자 목록을 불러오는 중...
                  </TableCell>
                </TableRow>
              )}
              {!usersQuery.isLoading && usersQuery.isError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-rose-600">
                    {usersQuery.error.message}
                  </TableCell>
                </TableRow>
              )}
              {!usersQuery.isLoading &&
                !usersQuery.isError &&
                rows.map((user) => {
                  const checked = selectedSet.has(user.id);
                  return (
                    <TableRow
                      key={user.id}
                      className={checked ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`${user.username} 사용자 선택`}
                        />
                      </TableCell>
                      <TableCell>{user.id}</TableCell>
                      <TableCell className="font-semibold">{user.username}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.status}</TableCell>
                      <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              {!usersQuery.isLoading &&
                !usersQuery.isError &&
                rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      조회 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      </section>

      {usersQuery.data && (
        <AdminPagination
          pageNumber={usersQuery.data.pageNumber}
          totalPages={usersQuery.data.totalPages}
          totalElements={usersQuery.data.totalElements}
          pageSize={usersQuery.data.pageSize}
          onPageChange={listParams.setPage}
          disabled={usersQuery.isFetching}
        />
      )}

      <ActionDialog
        open={Boolean(bulkActionTarget)}
        title={dialogTexts.title}
        content={dialogTexts.content}
        cancelText="취소"
        confirmText={dialogTexts.confirmText}
        confirmDisabled={isMutating}
        cancelDisabled={isMutating}
        preventAutoCloseOnConfirm
        onOpenChange={(open) => {
          if (!open) setBulkActionTarget(null);
        }}
        onConfirm={() => {
          void handleConfirmBulkAction();
        }}
      />
    </AdminShell>
  );
}
