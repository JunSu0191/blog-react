import { Heart } from "lucide-react";
import { usePostLike } from "../hooks/usePostLike";

type PostLikeButtonProps = {
  postId: number;
  initialLikeCount?: number;
};

export default function PostLikeButton({
  postId,
  initialLikeCount = 0,
}: PostLikeButtonProps) {
  const { status, toggleLike, isSyncing } = usePostLike(postId, {
    initialLikeCount,
  });
  const actionLabel = status.liked ? "좋아요 취소" : "좋아요";
  const ariaLabel = `${actionLabel}. 현재 좋아요 ${status.likeCount}개`;

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={isSyncing}
      aria-pressed={status.liked}
      aria-busy={isSyncing}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={[
        "group inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-[transform,background-color,color,border-color,box-shadow] duration-150 ease-out motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-400 dark:focus-visible:ring-offset-slate-900",
        status.liked
          ? "border-rose-200 bg-rose-50 text-rose-600 shadow-[0_6px_16px_-12px_rgba(244,63,94,0.7)] hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/50"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      <Heart
        className={[
          "h-4 w-4 transition-transform duration-150 ease-out group-hover:scale-110",
          status.liked ? "fill-current" : "",
        ].join(" ")}
      />
      <span>{actionLabel}</span>
      <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] font-bold tabular-nums dark:bg-white/10">
        {status.likeCount}
      </span>
      <span className="sr-only" aria-live="polite">
        좋아요 수 {status.likeCount}
      </span>
    </button>
  );
}
