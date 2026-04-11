import { Lock, LogIn, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionDialog, Button } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { isUnauthorizedError } from "@/shared/lib/api";
import { useCreateComment } from "../queries";
import type { CommentCreateRequest } from "../api";

interface CommentFormProps {
  postId: number;
  parentId?: number;
  compact?: boolean;
  presentation?: "default" | "sheet";
  onSubmitted?: () => void;
  onCancel?: () => void;
}

export default function CommentForm({
  postId,
  parentId,
  compact = false,
  presentation = "default",
  onSubmitted,
  onCancel,
}: CommentFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const [content, setContent] = useState("");
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const createCommentMutation = useCreateComment();
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;
  const shouldShowMutationError =
    createCommentMutation.isError &&
    !isUnauthorizedError(createCommentMutation.error);
  const isSheetPresentation = presentation === "sheet";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setIsLoginDialogOpen(true);
      return;
    }

    if (!content.trim()) {
      noticeDialog.show("댓글 내용을 입력해주세요.");
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        postId,
        parentId,
        content: content.trim(),
      } as CommentCreateRequest);
      setContent("");
      onSubmitted?.();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      console.error("댓글 생성 실패:", error);
      noticeDialog.show("댓글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  if (compact) {
    return (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900 sm:p-3"
      >
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="답글을 입력하세요"
          rows={3}
          disabled={createCommentMutation.isPending}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <div className="mt-2 flex items-center justify-end gap-1.5 sm:gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={createCommentMutation.isPending}
              className="h-8 rounded-lg px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            >
              취소
            </Button>
          ) : null}
          <Button
            type="submit"
            isLoading={createCommentMutation.isPending}
            className="h-8 rounded-lg bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700 sm:h-9 sm:px-3 sm:text-sm"
          >
            답글 등록
          </Button>
        </div>

        <ActionDialog
          {...noticeDialog.dialogProps}
        />

        <ActionDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
          icon={<Lock className="h-5 w-5" aria-hidden="true" />}
          title="로그인이 필요합니다"
          description="로그인 페이지로 이동하시겠습니까?"
          cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
          confirmIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
          cancelText="나중에 로그인하기"
          confirmText="로그인 페이지 이동"
          onConfirm={() => {
            navigate("/login", { state: currentPathWithSearchHash });
          }}
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80",
        isSheetPresentation ? "p-3 sm:rounded-2xl sm:p-4" : "p-3 sm:rounded-3xl sm:p-5",
      ].join(" ")}
    >
      <label
        className={[
          "mb-2 block font-bold text-slate-700 dark:text-slate-200",
          isSheetPresentation ? "text-xs sm:text-sm" : "text-sm",
        ].join(" ")}
      >
        댓글 작성
      </label>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="생각을 남겨보세요"
        rows={isSheetPresentation ? 3 : 4}
        disabled={createCommentMutation.isPending}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:rounded-2xl sm:px-4"
      />

      <div
        className={[
          "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
          isSheetPresentation ? "mt-2.5" : "mt-3",
        ].join(" ")}
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          서로 존중하는 커뮤니티 문화를 지켜주세요.
        </p>
        <Button
          type="submit"
          isLoading={createCommentMutation.isPending}
          className={[
            "w-full rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-700 sm:w-auto",
            isSheetPresentation ? "h-10 sm:px-4" : "h-10 sm:h-11 sm:rounded-xl sm:px-5",
          ].join(" ")}
        >
          등록
        </Button>
      </div>

      {shouldShowMutationError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          댓글 작성에 실패했습니다.
        </p>
      )}

      <ActionDialog
        {...noticeDialog.dialogProps}
      />

      <ActionDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="로그인이 필요합니다"
        description="로그인 페이지로 이동하시겠습니까?"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        cancelText="나중에 로그인하기"
        confirmText="로그인 페이지 이동"
        onConfirm={() => {
          navigate("/login", { state: currentPathWithSearchHash });
        }}
      />
    </form>
  );
}
