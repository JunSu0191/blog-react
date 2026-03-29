import { useAuthContext } from "@/shared/context/useAuthContext";
import type { CommentResponse } from "../api";
import { useComments } from "../queries";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";

interface CommentListProps {
  postId: number;
}

export default function CommentList({ postId }: CommentListProps) {
  const { data: comments, isLoading, error } = useComments(postId);
  const { user } = useAuthContext();

  const buildThread = (rawComments: CommentResponse[]) => {
    const byId = new Map<number, CommentResponse>();
    const childrenByParent = new Map<number, CommentResponse[]>();

    const visit = (node: CommentResponse) => {
      byId.set(node.id, { ...node, replies: [] });
      node.replies.forEach((reply) => visit(reply));
    };

    rawComments.forEach((comment) => visit(comment));
    rawComments.forEach((comment) => {
      if (!byId.has(comment.id)) {
        byId.set(comment.id, { ...comment, replies: [] });
      }
    });

    const all = Array.from(byId.values());
    all.forEach((comment) => {
      if (typeof comment.parentId !== "number") return;
      const group = childrenByParent.get(comment.parentId) || [];
      group.push(comment);
      childrenByParent.set(comment.parentId, group);
    });

    const roots = all.filter(
      (comment) =>
        typeof comment.parentId !== "number" || !byId.has(comment.parentId),
    );

    const sortByCreated = (list: CommentResponse[]) =>
      [...list].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

    return {
      roots: sortByCreated(roots),
      childrenByParent,
      sortByCreated,
    };
  };

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
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
        댓글을 불러올 수 없습니다.
      </div>
    );
  }

  const { roots, childrenByParent, sortByCreated } = buildThread(comments || []);

  return (
    <div className="space-y-4 sm:space-y-5">
      <CommentForm postId={postId} />

      {!comments || comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">아직 댓글이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">첫 댓글을 남겨 대화를 시작해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              댓글 {comments.length.toLocaleString()}개
            </p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              최신순
            </span>
          </div>
          {roots.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              isRoot
              childrenComments={sortByCreated(
                childrenByParent.get(comment.id) || [],
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
