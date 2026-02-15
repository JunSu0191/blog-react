import { useEffect, useState } from "react";
import { ActionDialog, Button } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { CommentReactionButtons } from "@/features/social";
import { useDeleteComment, useUpdateComment } from "../queries";
import type { CommentResponse } from "../api";

interface CommentItemProps {
  comment: CommentResponse;
  isOwner: boolean;
}

const formatDateTime = (raw: string) =>
  new Date(raw).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CommentItem({ comment, isOwner }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

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
      console.error("댓글 수정 실패:", error);
      noticeDialog.show("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteMutation.mutateAsync({ id: comment.id, postId: comment.postId });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
      noticeDialog.show("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
            {comment.name}
          </span>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(comment.createdAt)}</p>
        </div>

        {isOwner && !isEditing && (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)} className="rounded-lg text-xs">
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
        )}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={3}
            disabled={updateMutation.isPending}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" isLoading={updateMutation.isPending} onClick={handleUpdate} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700">
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
              className="rounded-lg"
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{comment.content}</p>
      )}

      <CommentReactionButtons
        commentId={comment.id}
        postId={comment.postId}
        initialLikeCount={comment.likeCount}
        initialDislikeCount={comment.dislikeCount}
        initialMyReaction={comment.myReaction}
      />

      <ActionDialog
        open={isDeleteDialogOpen}
        title="댓글 삭제"
        content="댓글을 삭제하면 복구할 수 없습니다."
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
        confirmClassName="rounded-xl bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200"
        cancelClassName="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        footerClassName="gap-2 sm:space-x-0"
      />

      <ActionDialog
        {...noticeDialog.dialogProps}
      />
    </div>
  );
}
