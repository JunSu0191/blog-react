import { useAuthContext } from "@/shared/context/useAuthContext";
import { useComments } from "../queries";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";

interface CommentListProps {
  postId: number;
}

export default function CommentList({ postId }: CommentListProps) {
  const { data: comments, isLoading, error } = useComments(postId);
  const { user } = useAuthContext();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">댓글을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
        댓글을 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CommentForm postId={postId} />

      {!comments || comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">아직 댓글이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">첫 댓글을 남겨 대화를 시작해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">총 {comments.length}개의 댓글</p>
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} isOwner={user?.id === comment.userId} />
          ))}
        </div>
      )}
    </div>
  );
}
