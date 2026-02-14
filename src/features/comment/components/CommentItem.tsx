import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";
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
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();

  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      alert("댓글 내용을 입력해주세요");
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
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      await deleteMutation.mutateAsync({ id: comment.id, postId: comment.postId });
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
            {comment.name}
          </span>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(comment.createdAt)}</p>
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
              onClick={handleDelete}
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
            className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
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
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.content}</p>
      )}
    </div>
  );
}
