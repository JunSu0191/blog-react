import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui";
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
import type { AdminCommentRow, AdminDeletedFilter } from "../types";
import { formatDateTime } from "../format";
import AdminShell from "../components/AdminShell";
import AdminPagination from "../components/AdminPagination";
import SortableHeader from "../components/SortableHeader";
import { useAdminListParams } from "../useAdminListParams";
import {
  useAdminComments,
  useBulkHideAdminComments,
  useBulkRestoreAdminComments,
} from "../queries";

type BulkCommentActionTarget = {
  action: "hide" | "restore";
  commentIds: number[];
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10개" },
  { value: 20, label: "20개" },
  { value: 30, label: "30개" },
  { value: 50, label: "50개" },
];

const DELETED_OPTIONS: Array<{ value: AdminDeletedFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "normal", label: "정상" },
  { value: "hidden", label: "숨김" },
];

function isDeleted(comment: AdminCommentRow) {
  return Boolean(comment.deletedAt);
}

function getCommentStatusClass(deleted: boolean) {
  return deleted
    ? "bg-rose-600 text-white hover:bg-rose-600"
    : "bg-emerald-600 text-white hover:bg-emerald-600";
}

export default function AdminCommentsPage() {
  const { success, error } = useToast();
  const listParams = useAdminListParams({ defaultSize: 20, includeDeleted: true });
  const commentsQuery = useAdminComments(listParams.params);
  const bulkHideMutation = useBulkHideAdminComments();
  const bulkRestoreMutation = useBulkRestoreAdminComments();

  const [keywordInput, setKeywordInput] = useState(listParams.keyword);
  const [selectedCommentIds, setSelectedCommentIds] = useState<number[]>([]);
  const [bulkActionTarget, setBulkActionTarget] =
    useState<BulkCommentActionTarget | null>(null);

  useEffect(() => {
    setKeywordInput(listParams.keyword);
  }, [listParams.keyword]);

  useEffect(() => {
    const visibleIds = new Set(
      (commentsQuery.data?.content || []).map((comment) => comment.id),
    );
    setSelectedCommentIds((previous) =>
      previous.filter((commentId) => visibleIds.has(commentId)),
    );
  }, [commentsQuery.data?.content]);

  const isMutating = bulkHideMutation.isPending || bulkRestoreMutation.isPending;
  const rows = commentsQuery.data?.content || [];
  const selectedSet = useMemo(() => new Set(selectedCommentIds), [selectedCommentIds]);
  const selectedRows = rows.filter((row) => selectedSet.has(row.id));
  const selectedNormalIds = selectedRows
    .filter((row) => !isDeleted(row))
    .map((row) => row.id);
  const selectedHiddenIds = selectedRows
    .filter((row) => isDeleted(row))
    .map((row) => row.id);
  const allVisibleIds = rows.map((row) => row.id);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedSet.has(id));

  const dialogTexts = useMemo(() => {
    if (!bulkActionTarget) return { title: "", content: "", confirmText: "확인" };
    const verb = bulkActionTarget.action === "hide" ? "숨김" : "복구";
    return {
      title: `댓글 일괄 ${verb}`,
      content: `${bulkActionTarget.commentIds.length}개 댓글을 ${verb} 처리하시겠습니까?`,
      confirmText: `${verb} 처리`,
    };
  }, [bulkActionTarget]);

  const toggleCommentSelection = (commentId: number) => {
    setSelectedCommentIds((previous) =>
      previous.includes(commentId)
        ? previous.filter((id) => id !== commentId)
        : [...previous, commentId],
    );
  };

  const toggleAllVisibleSelection = () => {
    setSelectedCommentIds((previous) => {
      if (allVisibleSelected) {
        return previous.filter((commentId) => !allVisibleIds.includes(commentId));
      }
      return Array.from(new Set([...previous, ...allVisibleIds]));
    });
  };

  const handleConfirmBulkAction = async () => {
    if (!bulkActionTarget || bulkActionTarget.commentIds.length === 0) return;
    try {
      if (bulkActionTarget.action === "hide") {
        await bulkHideMutation.mutateAsync({ commentIds: bulkActionTarget.commentIds });
        success(`${bulkActionTarget.commentIds.length}개 댓글을 숨김 처리했습니다.`);
      } else {
        await bulkRestoreMutation.mutateAsync({
          commentIds: bulkActionTarget.commentIds,
        });
        success(`${bulkActionTarget.commentIds.length}개 댓글을 복구했습니다.`);
      }
      setSelectedCommentIds((previous) =>
        previous.filter((id) => !bulkActionTarget.commentIds.includes(id)),
      );
      setBulkActionTarget(null);
    } catch (err) {
      error(parseErrorMessage(err, "댓글 일괄 처리에 실패했습니다."));
    }
  };

  return (
    <AdminShell
      title="댓글 관리"
      description="체크박스로 여러 댓글을 선택해 숨김/복구를 일괄 처리할 수 있습니다."
    >
      <section className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.45)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
        <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_170px]">
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
              placeholder="댓글 내용 또는 작성자 검색"
              aria-label="댓글 검색어"
            />
            <Button type="submit" className="h-11 shrink-0" aria-label="댓글 검색">
              검색
            </Button>
          </form>
          <Select
            label="상태"
            value={listParams.deleted}
            onValueChange={(value) =>
              listParams.setDeleted(value as AdminDeletedFilter)
            }
            options={DELETED_OPTIONS}
          />
          <Select
            label="페이지 크기"
            value={String(listParams.size)}
            onValueChange={(value) => listParams.setSize(Number(value))}
            options={PAGE_SIZE_OPTIONS}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              선택됨 {selectedCommentIds.length}개
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              총 {(commentsQuery.data?.totalElements ?? rows.length).toLocaleString()}개 댓글 중 현재 페이지 {rows.length}개
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedNormalIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  action: "hide",
                  commentIds: selectedNormalIds,
                })
              }
              aria-label="선택 댓글 숨김 처리"
            >
              선택 숨김 ({selectedNormalIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMutating || selectedHiddenIds.length === 0}
              onClick={() =>
                setBulkActionTarget({
                  action: "restore",
                  commentIds: selectedHiddenIds,
                })
              }
              aria-label="선택 댓글 복구 처리"
            >
              선택 복구 ({selectedHiddenIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isMutating || selectedCommentIds.length === 0}
              onClick={() => setSelectedCommentIds([])}
              aria-label="선택 댓글 해제"
            >
              선택 해제
            </Button>
          </div>
        </div>

        <div className="space-y-2 md:hidden">
          {commentsQuery.isLoading && (
            <div className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
              댓글 목록을 불러오는 중...
            </div>
          )}
          {!commentsQuery.isLoading && commentsQuery.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-center text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/25">
              {commentsQuery.error.message}
            </div>
          )}
          {!commentsQuery.isLoading &&
            !commentsQuery.isError &&
            rows.map((comment) => {
              const deleted = isDeleted(comment);
              const checked = selectedSet.has(comment.id);
              return (
                <article
                  key={comment.id}
                  className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCommentSelection(comment.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`${comment.id} 댓글 선택`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {comment.content}
                        </p>
                        <Badge
                          className={
                            deleted
                              ? "bg-rose-600 text-white hover:bg-rose-600"
                              : "bg-emerald-600 text-white hover:bg-emerald-600"
                          }
                        >
                          {deleted ? "숨김" : "정상"}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {comment.postTitle || `게시글 #${comment.postId ?? "-"}`}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {comment.authorName || comment.username || "-"} ·{" "}
                        {formatDateTime(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          {!commentsQuery.isLoading &&
            !commentsQuery.isError &&
            rows.length === 0 && (
              <div className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
                조회 결과가 없습니다.
              </div>
            )}
        </div>

        <div className="hidden md:block">
          <Table className="min-w-[1120px]">
            <TableHead>
              <TableRow>
                <TableHeader className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleSelection}
                    disabled={allVisibleIds.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label="현재 페이지 댓글 전체 선택"
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
                <TableHeader className="min-w-[260px]">댓글 내용</TableHeader>
                <TableHeader>게시글</TableHeader>
                <TableHeader>작성자</TableHeader>
                <TableHeader>
                  <SortableHeader
                    label="생성일"
                    field="createdAt"
                    currentField={listParams.sortField}
                    direction={listParams.sortDirection}
                    onToggle={listParams.toggleSort}
                  />
                </TableHeader>
                <TableHeader>상태</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {commentsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    댓글 목록을 불러오는 중...
                  </TableCell>
                </TableRow>
              )}
              {!commentsQuery.isLoading && commentsQuery.isError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-rose-600">
                    {commentsQuery.error.message}
                  </TableCell>
                </TableRow>
              )}
              {!commentsQuery.isLoading &&
                !commentsQuery.isError &&
                rows.map((comment) => {
                  const deleted = isDeleted(comment);
                  const checked = selectedSet.has(comment.id);
                  return (
                    <TableRow
                      key={comment.id}
                      className={checked ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCommentSelection(comment.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`${comment.id} 댓글 선택`}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          #{comment.id}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[340px] whitespace-normal break-words">
                        <div className="min-w-0">
                          <p className="line-clamp-3 font-medium text-slate-950 dark:text-slate-50">
                            {comment.content}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {deleted ? "운영 숨김 대상 댓글" : "현재 노출 중인 댓글"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {comment.postTitle || `게시글 #${comment.postId ?? "-"}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            연결된 원문
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {comment.authorName || comment.username || "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            작성 사용자
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {formatDateTime(comment.createdAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            생성 시각
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCommentStatusClass(deleted)}>
                          {deleted ? "숨김" : "정상"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!commentsQuery.isLoading &&
                !commentsQuery.isError &&
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

      {commentsQuery.data && (
        <AdminPagination
          pageNumber={commentsQuery.data.pageNumber}
          totalPages={commentsQuery.data.totalPages}
          totalElements={commentsQuery.data.totalElements}
          pageSize={commentsQuery.data.pageSize}
          onPageChange={listParams.setPage}
          disabled={commentsQuery.isFetching}
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
