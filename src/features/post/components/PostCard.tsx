import { Link } from "react-router-dom";
import type { Post } from "../api";

interface PostCardProps {
  post: Post;
  index: number;
  onPrefetch?: (postId: number) => void;
}

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const formatDate = (raw?: string) => {
  if (!raw) return "날짜 없음";
  return new Date(raw).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function PostCard({ post, index, onPrefetch }: PostCardProps) {
  const excerpt = stripHtml(post.content || "").slice(0, 130);
  const attachmentCount = post.attachFiles?.length || 0;

  return (
    <Link
      to={`/posts/${post.id}`}
      className="block"
      onMouseEnter={() => onPrefetch?.(post.id)}
      onFocus={() => onPrefetch?.(post.id)}
    >
      <article
        className="card-reveal group relative h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_64px_-42px_rgba(15,23,42,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_30px_70px_-44px_rgba(2,132,199,0.6)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_70px_-50px_rgba(2,6,23,0.9)] dark:hover:border-blue-700/70 dark:hover:shadow-[0_34px_76px_-52px_rgba(8,47,73,0.95)]"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-extrabold leading-snug tracking-tight text-slate-900 transition-colors duration-300 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
            {post.title}
          </h3>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            #{post.id}
          </span>
        </div>

        <p className="line-clamp-3 min-h-[64px] text-sm leading-6 text-slate-600 dark:text-slate-300">
          {excerpt || "본문 미리보기가 없습니다."}
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <span>{formatDate(post.createdAt)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            작성자 {post.userId}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">3 min read</span>
          {attachmentCount > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              첨부 {attachmentCount}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              텍스트
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
