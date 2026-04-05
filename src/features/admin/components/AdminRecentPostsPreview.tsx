import { cn } from "@/shared/lib/cn";
import Button from "@/shared/ui/Button";
import ActionTextLink from "@/shared/ui/ActionTextLink";
import { formatDateTime } from "../format";
import { useAdminRecentPosts } from "../queries";

function StatusBadge({ hidden }: { hidden: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        hidden
          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
      )}
    >
      {hidden ? "숨김" : "정상"}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60"
        />
      ))}
    </div>
  );
}

export default function AdminRecentPostsPreview() {
  const query = useAdminRecentPosts();

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            최근 게시글
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            최신 게시글 상태를 빠르게 확인합니다.
          </p>
        </div>
        <ActionTextLink to="/admin/posts" className="text-xs">
          더보기
        </ActionTextLink>
      </header>

      {query.isLoading ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
            최근 게시글을 불러오지 못했습니다.
          </p>
          <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-200/80">
            {query.error.message}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => query.refetch()}
            aria-label="최근 게시글 다시 시도"
          >
            다시 시도
          </Button>
        </div>
      ) : (query.data?.content.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-400">
          최근 데이터가 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {query.data?.content.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-slate-200/70 px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-700/70 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/20"
            >
              <div className="flex items-center gap-2">
                <StatusBadge hidden={Boolean(post.deletedAt)} />
                <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {post.title}
                </p>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {post.authorName || post.username || "알 수 없음"} ·{" "}
                {formatDateTime(post.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
