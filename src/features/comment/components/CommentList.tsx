import { useAuthContext } from "@/shared/context/useAuthContext";
import type { CommentResponse } from "../api";
import { useComments } from "../queries";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";

interface CommentListProps {
  postId: number;
  presentation?: "default" | "sheet";
  hideComposer?: boolean;
  hideListHeader?: boolean;
  onMobileReply?: (comment: CommentResponse) => void;
  onMobileEdit?: (comment: CommentResponse) => void;
}

export function countTotalComments(rawComments: CommentResponse[]) {
  return rawComments.reduce(
    (total, comment) => total + 1 + Math.max(0, comment.replyCount || 0),
    0,
  );
}

export default function CommentList({
  postId,
  presentation = "default",
  hideComposer = false,
  hideListHeader = false,
  onMobileReply,
  onMobileEdit,
}: CommentListProps) {
  const { data: comments, isLoading, error } = useComments(postId);
  const { user } = useAuthContext();
  const isSheetPresentation = presentation === "sheet";

  if (isLoading) {
    return (
      <div
        className={[
          "text-center",
          isSheetPresentation ? "py-5" : "py-8",
        ].join(" ")}
      >
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          댓글을 불러오는 중...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-y border-rose-200 py-4 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:text-rose-200">
        댓글을 불러올 수 없습니다.
      </div>
    );
  }

  const commentData = comments || [];
  const totalCommentCount = countTotalComments(commentData);

  return (
    <div
      className={
        isSheetPresentation ? "space-y-3 sm:space-y-4" : "space-y-4 sm:space-y-5"
      }
    >
      {!hideComposer ? (
        <CommentForm
          postId={postId}
          presentation={isSheetPresentation ? "sheet" : "default"}
        />
      ) : null}

      {commentData.length === 0 ? (
        <div
          className={[
            "border-y border-dashed border-slate-300 text-center dark:border-slate-700",
            isSheetPresentation ? "py-5" : "py-8",
          ].join(" ")}
        >
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            아직 댓글이 없습니다.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            첫 댓글을 남겨 대화를 시작해보세요.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {!hideListHeader ? (
            <div className="flex items-center justify-between border-y border-slate-200 py-2.5 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                댓글 {totalCommentCount.toLocaleString()}개
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                최신순
              </span>
            </div>
          ) : null}
          {commentData.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              presentation={presentation}
              onMobileReply={onMobileReply}
              onMobileEdit={onMobileEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
