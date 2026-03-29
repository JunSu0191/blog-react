import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui";
import {
  ActionDialog,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import type { AdminCategoryRow } from "../types";
import { formatDateTime } from "../format";
import AdminShell from "../components/AdminShell";
import {
  useAdminCategories,
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from "../queries";

function normalizeCategoryName(value: string) {
  return value.trim();
}

function normalizeCategorySlug(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function AdminCategoriesPage() {
  const { success, error } = useToast();

  const categoriesQuery = useAdminCategories();
  const createMutation = useCreateAdminCategory();
  const updateMutation = useUpdateAdminCategory();
  const deleteMutation = useDeleteAdminCategory();

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryRow | null>(null);

  const sortedRows = useMemo(
    () => [...(categoriesQuery.data || [])].sort((a, b) => a.id - b.id),
    [categoriesQuery.data],
  );

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const startEdit = (category: AdminCategoryRow) => {
    setEditingCategoryId(category.id);
    setEditingName(category.name);
    setEditingSlug(category.slug || "");
  };

  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingName("");
    setEditingSlug("");
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = normalizeCategoryName(newName);
    const slug = normalizeCategorySlug(newSlug);

    if (!name) {
      error("카테고리 이름을 입력해 주세요.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name,
        slug,
      });
      setNewName("");
      setNewSlug("");
      success("카테고리를 생성했습니다.");
    } catch (createError) {
      error(parseErrorMessage(createError, "카테고리 생성에 실패했습니다."));
    }
  };

  const handleUpdate = async () => {
    if (editingCategoryId === null) return;

    const name = normalizeCategoryName(editingName);
    const slug = normalizeCategorySlug(editingSlug);

    if (!name) {
      error("카테고리 이름을 입력해 주세요.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        categoryId: editingCategoryId,
        request: {
          name,
          slug,
        },
      });
      cancelEdit();
      success("카테고리를 수정했습니다.");
    } catch (updateError) {
      error(parseErrorMessage(updateError, "카테고리 수정에 실패했습니다."));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync({ categoryId: deleteTarget.id });
      success("카테고리를 삭제했습니다.");
      setDeleteTarget(null);
    } catch (deleteError) {
      error(parseErrorMessage(deleteError, "카테고리 삭제에 실패했습니다."));
    }
  };

  return (
    <AdminShell
      title="카테고리 관리"
      description="게시글 카테고리를 생성/수정/삭제하고 글쓰기 카테고리 목록과 연동합니다."
    >
      <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.45)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            void handleCreate(event);
          }}
        >
          <Input
            label="카테고리 이름"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="예: Frontend"
            maxLength={40}
          />
          <Input
            label="슬러그(선택)"
            value={newSlug}
            onChange={(event) => setNewSlug(event.target.value)}
            placeholder="예: frontend"
            maxLength={60}
          />
          <div className="sm:pt-[1.9rem]">
            <Button
              type="submit"
              className="h-11 w-full sm:w-auto"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "생성 중..." : "카테고리 생성"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.45)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            총 {sortedRows.length}개 카테고리
          </p>
          <Badge className="bg-blue-600 text-white hover:bg-blue-600">
            연동 대상: 글쓰기 카테고리
          </Badge>
        </div>

        <div className="space-y-2 md:hidden">
          {categoriesQuery.isLoading ? (
            <div className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700">
              카테고리 목록을 불러오는 중...
            </div>
          ) : null}
          {!categoriesQuery.isLoading && categoriesQuery.isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-center text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/25">
              {categoriesQuery.error.message}
            </div>
          ) : null}
          {!categoriesQuery.isLoading &&
            !categoriesQuery.isError &&
            sortedRows.map((category) => {
              const isEditing = editingCategoryId === category.id;
              return (
                <article
                  key={category.id}
                  className="space-y-2 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        ID #{category.id}
                      </p>
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        placeholder="카테고리 이름"
                        maxLength={40}
                      />
                      <Input
                        value={editingSlug}
                        onChange={(event) => setEditingSlug(event.target.value)}
                        placeholder="슬러그(선택)"
                        maxLength={60}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {category.name}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                            {category.slug || "-"}
                          </p>
                        </div>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          #{category.id}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      게시글 {category.postCount ?? 0}개
                    </span>
                    <span className="truncate">수정 {formatDateTime(category.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => {
                            void handleUpdate();
                          }}
                        >
                          저장
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isMutating}
                          onClick={cancelEdit}
                        >
                          취소
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => startEdit(category)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isMutating}
                          onClick={() => setDeleteTarget(category)}
                        >
                          삭제
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[980px]">
            <TableHead>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHeader className="w-20 font-mono text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  ID
                </TableHeader>
                <TableHeader className="text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  이름
                </TableHeader>
                <TableHeader className="text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  슬러그
                </TableHeader>
                <TableHeader className="w-28 text-right text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  게시글 수
                </TableHeader>
                <TableHeader className="w-44 text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  수정일
                </TableHeader>
                <TableHeader className="w-44 text-right text-[13px] normal-case tracking-normal text-slate-600 dark:text-slate-300">
                  작업
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoriesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    카테고리 목록을 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : null}
              {!categoriesQuery.isLoading && categoriesQuery.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-rose-600 dark:text-rose-300"
                  >
                    {categoriesQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : null}
              {!categoriesQuery.isLoading &&
                !categoriesQuery.isError &&
                sortedRows.map((category) => {
                  const isEditing = editingCategoryId === category.id;
                  return (
                    <TableRow
                      key={category.id}
                      className={isEditing ? "bg-blue-50/55 dark:bg-blue-950/15" : ""}
                    >
                      <TableCell>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          #{category.id}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            placeholder="카테고리 이름"
                            maxLength={40}
                          />
                        ) : (
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950 dark:text-slate-50">
                              {category.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              카테고리 이름
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingSlug}
                            onChange={(event) => setEditingSlug(event.target.value)}
                            placeholder="슬러그(선택)"
                            maxLength={60}
                          />
                        ) : (
                          <div className="min-w-0">
                            <p className="font-mono text-sm text-slate-600 dark:text-slate-300">
                              {category.slug || "-"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              URL 식별자
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {category.postCount ?? 0}개
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {formatDateTime(category.updatedAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            최근 수정 기준
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isMutating}
                                onClick={() => {
                                  void handleUpdate();
                                }}
                              >
                                저장
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={isMutating}
                                onClick={cancelEdit}
                              >
                                취소
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isMutating}
                                onClick={() => startEdit(category)}
                              >
                                수정
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={isMutating}
                                onClick={() => setDeleteTarget(category)}
                              >
                                삭제
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!categoriesQuery.isLoading &&
              !categoriesQuery.isError &&
              sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    등록된 카테고리가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <ActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="카테고리 삭제"
        content={`'${deleteTarget?.name || ""}' 카테고리를 삭제하시겠습니까?`}
        cancelText="취소"
        confirmText={deleteMutation.isPending ? "삭제 중..." : "삭제"}
        confirmDisabled={deleteMutation.isPending}
        cancelDisabled={deleteMutation.isPending}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </AdminShell>
  );
}
