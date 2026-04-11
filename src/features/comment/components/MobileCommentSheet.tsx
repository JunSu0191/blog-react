import { useMemo, useState } from "react";
import { Lock, LogIn, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionDialog, Button } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { isUnauthorizedError } from "@/shared/lib/api";
import type { CommentCreateRequest, CommentResponse } from "../api";
import { useCreateComment, useUpdateComment } from "../queries";
import CommentList from "./CommentList";

type ComposerMode =
  | { type: "create-root" }
  | { type: "create-reply"; target: CommentResponse }
  | { type: "edit-comment"; target: CommentResponse };

interface MobileCommentSheetProps {
  postId: number;
  commentCount: number;
}

function resolvePlaceholder(mode: ComposerMode) {
  if (mode.type === "create-reply") return "답글을 입력하세요";
  if (mode.type === "edit-comment") return "댓글을 수정하세요";
  return "댓글을 입력하세요";
}

function resolveModeLabel(mode: ComposerMode) {
  if (mode.type === "create-reply") return "답글 작성 중";
  if (mode.type === "edit-comment") return "댓글 수정 중";
  return "댓글 작성";
}

export default function MobileCommentSheet({
  postId,
  commentCount,
}: MobileCommentSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const [mode, setMode] = useState<ComposerMode>({ type: "create-root" });
  const [content, setContent] = useState("");
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const createCommentMutation = useCreateComment();
  const updateCommentMutation = useUpdateComment();
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;

  const submitLabel = useMemo(() => {
    if (mode.type === "edit-comment") return "수정";
    return "등록";
  }, [mode.type]);

  const isSubmitting =
    createCommentMutation.isPending || updateCommentMutation.isPending;

  const resetComposer = () => {
    setMode({ type: "create-root" });
    setContent("");
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setIsLoginDialogOpen(true);
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      noticeDialog.show("댓글 내용을 입력해주세요.");
      return;
    }

    try {
      if (mode.type === "edit-comment") {
        await updateCommentMutation.mutateAsync({
          id: mode.target.id,
          postId,
          parentId: mode.target.parentId,
          req: { content: trimmed },
        });
      } else {
        await createCommentMutation.mutateAsync({
          postId,
          parentId: mode.type === "create-reply" ? mode.target.id : undefined,
          content: trimmed,
        } as CommentCreateRequest);
      }
      resetComposer();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      noticeDialog.show("댓글 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-1 pb-2 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            댓글 {commentCount.toLocaleString()}개
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            최신순
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain py-2">
          <CommentList
            postId={postId}
            presentation="sheet"
            hideComposer
            hideListHeader
            onMobileReply={(comment) => {
              setMode({ type: "create-reply", target: comment });
              setContent("");
            }}
            onMobileEdit={(comment) => {
              setMode({ type: "edit-comment", target: comment });
              setContent(comment.content);
            }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {resolveModeLabel(mode)}
            </p>
            {mode.type !== "create-root" ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                {mode.target.displayName || mode.target.nickname || mode.target.name}
              </p>
            ) : null}
          </div>
          {mode.type !== "create-root" ? (
            <button
              type="button"
              onClick={resetComposer}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              취소
            </button>
          ) : null}
        </div>
        <div className="border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-800 dark:bg-slate-800/70">
          <div className="flex items-end gap-2">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={resolvePlaceholder(mode)}
              rows={1}
              disabled={isSubmitting}
              className="min-h-[38px] max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[16px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <Button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              isLoading={isSubmitting}
              loadingText={submitLabel}
              className="h-[38px] shrink-0 rounded-xl bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      <ActionDialog {...noticeDialog.dialogProps} />

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
    </div>
  );
}
