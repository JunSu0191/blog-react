import { Flame, Lock, LogIn, Tags, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActionDialog, Button, TagChip } from "@/shared/ui";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { preloadCreateFlow } from "@/app/routePreload";
import PostFeedListItem from "../components/feed/PostFeedListItem";
import { useInfinitePostFeed, usePostFeed } from "../queries";
import { resolvePostPath } from "../utils/postContent";

const PAGE_SIZE = 20;

export default function PostListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchText = searchParams.get("q")?.trim() ?? "";
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;

  const desktopFeedQuery = usePostFeed(
    {
      q: searchText.trim() || undefined,
      page,
      size: PAGE_SIZE,
    },
    { enabled: !isMobile },
  );

  const mobileFeedQuery = useInfinitePostFeed(
    {
      q: searchText.trim() || undefined,
      size: PAGE_SIZE,
    },
    { enabled: isMobile },
  );

  const posts = useMemo(() => {
    if (isMobile) {
      return mobileFeedQuery.data?.pages.flatMap((pageData) => pageData.content) ?? [];
    }
    return desktopFeedQuery.data?.content ?? [];
  }, [desktopFeedQuery.data?.content, isMobile, mobileFeedQuery.data?.pages]);

  const mobilePages = mobileFeedQuery.data?.pages ?? [];
  const activePageInfo = isMobile
    ? mobilePages[mobilePages.length - 1]
    : desktopFeedQuery.data;

  const totalPages = activePageInfo?.totalPages || 1;
  const totalElements = activePageInfo?.totalElements || posts.length;
  const canMovePrev = page > 0;
  const canMoveNext = page + 1 < totalPages;

  const isLoading = isMobile ? mobileFeedQuery.isLoading : desktopFeedQuery.isLoading;
  const activeError = isMobile ? mobileFeedQuery.error : desktopFeedQuery.error;
  const refetchFeed = isMobile
    ? () => mobileFeedQuery.refetch()
    : () => desktopFeedQuery.refetch();

  const popularPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => {
          if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
          return b.likeCount - a.likeCount;
        })
        .slice(0, 5),
    [posts],
  );

  const hotTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        const normalized = tag.name.trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [posts]);

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  useEffect(() => {
    if (!isMobile) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!mobileFeedQuery.hasNextPage || mobileFeedQuery.isFetchingNextPage) return;
        void mobileFeedQuery.fetchNextPage();
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [
    isMobile,
    mobileFeedQuery.fetchNextPage,
    mobileFeedQuery.hasNextPage,
    mobileFeedQuery.isFetchingNextPage,
  ]);

  const feedRowHoverClass =
    "group/post transition-all duration-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-400/60 hover:bg-blue-50/80 hover:shadow-sm dark:hover:bg-blue-950/20";

  const handleClickCreate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isAuthenticated) return;
    event.preventDefault();
    setIsLoginDialogOpen(true);
  };

  return (
    <div className="route-enter space-y-6 pt-2 font-sans sm:pt-0">
      <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(239,246,255,0.98))] p-6 shadow-[0_24px_80px_-56px_rgba(37,99,235,0.42)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.98))]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              ARTICLE INDEX
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              모든 글 탐색
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              검색과 목록 중심으로 탐색하는 페이지입니다. 추천과 발견은 홈에서, 깊은 탐색은 여기서 이어집니다.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Link
                to="/home"
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20 dark:hover:text-blue-300"
              >
                홈으로 이동
              </Link>
              {searchText ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  검색어: {searchText}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  최신 글부터 탐색
                </span>
              )}
            </div>
          </div>

          <Link
            to="/posts/create"
            onClick={handleClickCreate}
            onMouseEnter={() => {
              void preloadCreateFlow();
            }}
            onFocus={() => {
              void preloadCreateFlow();
            }}
          >
            <Button className="rounded-lg">
              글 작성
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                총 <span className="font-semibold">{totalElements.toLocaleString()}</span>개 글
              </p>
              {isMobile ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  노출 {posts.length.toLocaleString()} / {totalElements.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  페이지 {page + 1} / {totalPages}
                </p>
              )}
            </div>
          </section>

          {isLoading ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {Array.from({ length: 8 }).map((_, index) => (
                  <article
                    key={`post-skeleton-${index}`}
                    className="grid gap-4 p-4 sm:grid-cols-[1fr_230px] sm:p-5"
                  >
                    <div className="space-y-3">
                      <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <div className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 sm:h-28" />
                  </article>
                ))}
              </div>
            </section>
          ) : activeError ? (
            <section className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
              <h2 className="text-lg font-bold text-rose-700 dark:text-rose-200">
                글 목록을 불러오지 못했습니다.
              </h2>
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
                {activeError.message}
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => {
                  void refetchFeed();
                }}
              >
                다시 시도
              </Button>
            </section>
          ) : posts.length === 0 ? (
            <section className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {searchText ? "검색 결과가 없습니다." : "아직 게시글이 없습니다."}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {searchText
                  ? "검색어를 조정해 주세요."
                  : "첫 게시글을 작성해 피드를 채워보세요."}
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {posts.map((post) => (
                  <PostFeedListItem
                    key={post.id}
                    post={post}
                    destination={resolvePostPath(post.id)}
                    className={feedRowHoverClass}
                  />
                ))}
              </div>
            </section>
          )}

          {isMobile && posts.length > 0 ? (
            <div ref={loadMoreRef} className="py-3 text-center">
              {mobileFeedQuery.isFetchingNextPage ? (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  게시글을 더 불러오는 중...
                </p>
              ) : mobileFeedQuery.hasNextPage ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  아래로 스크롤하면 다음 글을 불러옵니다.
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  마지막 게시글까지 확인했습니다.
                </p>
              )}
            </div>
          ) : null}

          {!isMobile ? (
            <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                페이지 {page + 1} / {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canMovePrev}
                  onClick={() => {
                    if (!canMovePrev) return;
                    setPage((prev) => prev - 1);
                  }}
                >
                  이전
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canMoveNext}
                  onClick={() => {
                    if (!canMoveNext) return;
                    setPage((prev) => prev + 1);
                  }}
                >
                  다음
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Flame className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                인기 글 TOP 5
              </h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                조회수 기준
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {popularPosts.length > 0 ? (
                popularPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    to={resolvePostPath(post.id)}
                    className="group block rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:hover:border-blue-900/70 dark:hover:bg-blue-950/30"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-1 text-[11px] font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                          {post.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          조회 {post.viewCount.toLocaleString()} · 좋아요{" "}
                          {post.likeCount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  목록을 불러오면 인기 글이 표시됩니다.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Tags className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              인기 태그
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hotTags.length > 0 ? (
                hotTags.map(([name, count]) => (
                    <Link key={name} to={`/tags/${encodeURIComponent(name)}`}>
                      <TagChip label={name} count={count} />
                    </Link>
                  ))
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  태그 데이터가 없습니다.
                </p>
              )}
            </div>
          </section>
        </aside>
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
    </div>
  );
}
