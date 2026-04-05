import { useState } from "react";
import { CornerDownRight, Lock, LogIn, Trash2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ActionDialog, Button } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { isUnauthorizedError } from "@/shared/lib/api";
import { resolveDisplayName } from "@/shared/lib/displayName";
import { CommentReactionButtons } from "@/features/social";
import { useDeleteComment, useUpdateComment } from "../queries";
import type { CommentResponse } from "../api";
import CommentForm from "./CommentForm";

interface CommentItemProps {
  comment: CommentResponse;
  currentUserId?: number;
  isRoot?: boolean;
  depth?: number;
  childrenComments?: CommentResponse[];
}

const formatDateTime = (raw: string) =>
  new Date(raw).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  childrenComments = [],
}: CommentItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;
  const isOwner =
    typeof currentUserId === "number" && currentUserId === comment.userId;
  const isReply = depth > 0;
  const authorName = resolveDisplayName(comment, "익명");
  const authorUsername = comment.username?.trim() || "";
  const authorBlogPath = authorUsername
    ? `/${encodeURIComponent(authorUsername)}`
    : null;

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      noticeDialog.show("댓글 내용을 입력해주세요.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: comment.id,
        postId: comment.postId,
        req: { content: editContent },
      });
      setIsEditing(false);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      console.error("댓글 수정 실패:", error);
      noticeDialog.show("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteMutation.mutateAsync({
        id: comment.id,
        postId: comment.postId,
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      console.error("댓글 삭제 실패:", error);
      noticeDialog.show("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div
      className={[
        "rounded-2xl border p-3 shadow-sm sm:p-4",
        isReply
          ? "border-slate-200/80 bg-slate-50/70 dark:border-slate-700/80 dark:bg-slate-900/70"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-start gap-2.5 sm:gap-3">
          <span
            className={[
              "inline-flex items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100",
              isReply ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
            ].join(" ")}
          >
            {authorName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            {authorBlogPath ? (
              <Link
                to={authorBlogPath}
                className="truncate text-sm font-bold text-slate-900 hover:underline dark:text-slate-100"
              >
                {authorName}
              </Link>
            ) : (
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {authorName}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatDateTime(comment.createdAt)}</span>
              {isReply ? (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  답글
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {isOwner && !isEditing ? (
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditContent(comment.content);
                setIsEditing(true);
              }}
              className="rounded-lg text-xs"
            >
              수정
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              isLoading={deleteMutation.isPending}
              className="rounded-lg border-rose-200 bg-rose-50 text-xs text-rose-700 hover:bg-rose-100"
            >
              삭제
            </Button>
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2.5">
          <textarea
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={3}
            disabled={updateMutation.isPending}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3"
          />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              size="sm"
              isLoading={updateMutation.isPending}
              onClick={handleUpdate}
              className="h-8 rounded-lg bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700 sm:h-9 sm:px-3 sm:text-sm"
            >
              수정 완료
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setEditContent(comment.content);
              }}
              disabled={updateMutation.isPending}
              className="h-8 rounded-lg px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
          {comment.content}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CommentReactionButtons
          commentId={comment.id}
          postId={comment.postId}
          initialLikeCount={comment.likeCount}
          initialDislikeCount={comment.dislikeCount}
          initialMyReaction={comment.myReaction}
        />
        {depth < 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onTouchStart={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              if (!isAuthenticated) {
                setIsLoginDialogOpen(true);
                return;
              }
              setIsReplying((prev) => !prev);
            }}
            className="touch-manipulation gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            답글
          </Button>
        ) : null}
      </div>

      {isReplying && depth < 1 ? (
        <div className="mt-3">
          <CommentForm
            postId={comment.postId}
            parentId={comment.id}
            compact
            onSubmitted={() => setIsReplying(false)}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      ) : null}

      {childrenComments.length > 0 ? (
        <div className="mt-3 space-y-2.5 border-l border-slate-200 pl-2.5 dark:border-slate-700 sm:mt-4 sm:space-y-3 sm:pl-4">
          {childrenComments.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              depth={depth + 1}
              isRoot={false}
              childrenComments={[]}
            />
          ))}
        </div>
      ) : null}

      <ActionDialog
        open={isDeleteDialogOpen}
        icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
        title="댓글 삭제"
        content="댓글을 삭제하면 복구할 수 없습니다."
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        iconWrapperClassName="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
        cancelText="취소"
        confirmText={deleteMutation.isPending ? "삭제 중..." : "삭제"}
        confirmDisabled={deleteMutation.isPending}
        cancelDisabled={deleteMutation.isPending}
        preventAutoCloseOnConfirm
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        onOpenChange={(open) => {
          if (deleteMutation.isPending) return;
          setIsDeleteDialogOpen(open);
        }}
        confirmClassName="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200"
        cancelClassName="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        footerClassName="gap-2 sm:space-x-0"
      />

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
