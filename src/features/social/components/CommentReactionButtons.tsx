import { Lock, LogIn, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionDialog } from "@/shared/ui";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { useCommentReaction } from "../hooks/useCommentReaction";
import type { CommentReactionType } from "../types";

type CommentReactionButtonsProps = {
  commentId: number;
  postId: number;
  initialLikeCount?: number;
  initialDislikeCount?: number;
  initialMyReaction?: CommentReactionType | null;
};

function reactionBadgeClassName(active: boolean, tone: "like" | "dislike") {
  if (!active) {
    return "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";
  }

  if (tone === "like") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/45";
  }

  return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/45";
}

export default function CommentReactionButtons({
  commentId,
  postId,
  initialLikeCount = 0,
  initialDislikeCount = 0,
  initialMyReaction = null,
}: CommentReactionButtonsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const isAuthenticated = Boolean(user);
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;
  const { status, reactToLike, reactToDislike, isSyncing } = useCommentReaction(
    commentId,
    {
      postId,
      enabled: isAuthenticated,
      onUnauthorized: () => {
        setIsLoginDialogOpen(true);
      },
      initialStatus: {
        commentId,
        likeCount: initialLikeCount,
        dislikeCount: initialDislikeCount,
        myReaction: initialMyReaction ?? undefined,
      },
    },
  );
  const likeActionLabel =
    status.myReaction === "LIKE" ? "좋아요 취소" : "좋아요";
  const dislikeActionLabel =
    status.myReaction === "DISLIKE" ? "싫어요 취소" : "싫어요";

  const handleLikeClick = () => {
    if (!isAuthenticated) {
      setIsLoginDialogOpen(true);
      return;
    }
    reactToLike();
  };

  const handleDislikeClick = () => {
    if (!isAuthenticated) {
      setIsLoginDialogOpen(true);
      return;
    }
    reactToDislike();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleLikeClick}
          disabled={isSyncing}
          aria-pressed={status.myReaction === "LIKE"}
          aria-busy={isSyncing}
          aria-label={`${likeActionLabel}. 현재 좋아요 ${status.likeCount}개`}
          title={`${likeActionLabel}. 현재 좋아요 ${status.likeCount}개`}
          className={[
            "group inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-[transform,background-color,color,border-color] duration-150 ease-out motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 sm:px-2.5 sm:text-xs dark:focus-visible:ring-offset-slate-900",
            reactionBadgeClassName(status.myReaction === "LIKE", "like"),
          ].join(" ")}
        >
          <ThumbsUp className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-0.5" />
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 tabular-nums dark:bg-white/10">
            {status.likeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={handleDislikeClick}
          disabled={isSyncing}
          aria-pressed={status.myReaction === "DISLIKE"}
          aria-busy={isSyncing}
          aria-label={`${dislikeActionLabel}. 현재 싫어요 ${status.dislikeCount}개`}
          title={`${dislikeActionLabel}. 현재 싫어요 ${status.dislikeCount}개`}
          className={[
            "group inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-[transform,background-color,color,border-color] duration-150 ease-out motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-400 sm:px-2.5 sm:text-xs dark:focus-visible:ring-offset-slate-900",
            reactionBadgeClassName(status.myReaction === "DISLIKE", "dislike"),
          ].join(" ")}
        >
          <ThumbsDown className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-y-0.5" />
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 tabular-nums dark:bg-white/10">
            {status.dislikeCount}
          </span>
        </button>

        <span className="sr-only" aria-live="polite">
          좋아요 {status.likeCount}개, 싫어요 {status.dislikeCount}개
        </span>
      </div>

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
    </>
  );
}
