import { useEffect, useMemo, useRef, useState } from "react";
import PostList from "../components/PostList";
import { useInfinitePosts, usePosts } from "../queries";
import type { Post, PostsPageRequest } from "../api";
import { preloadCreateFlow } from "@/app/routePreload";
import PostFeedHero from "../components/feed/PostFeedHero";
import PostFeedControls from "../components/feed/PostFeedControls";
import PostFeedPagination from "../components/feed/PostFeedPagination";

type Category = "all" | "tech" | "daily" | "review";
type ViewMode = "grid" | "list";
type FeedMode = "infinite" | "pagination";

const inferCategory = (post: Post): Exclude<Category, "all"> => {
  const types: Array<Exclude<Category, "all">> = ["tech", "daily", "review"];
  return types[(post.id + post.userId) % types.length];
};

const getReadMinutes = (content: string) => {
  const plain = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const charsPerMinute = 450;
  return Math.max(1, Math.ceil(plain.length / charsPerMinute));
};

export default function PostListPage() {
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<PostsPageRequest>({ page: 0, size: 9 });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [feedMode, setFeedMode] = useState<FeedMode>("infinite");

  const paginationPostsQuery = usePosts(query, {
    enabled: feedMode === "pagination",
  });
  const infinitePostsQuery = useInfinitePosts(
    {
      size: query.size ?? 9,
      keyword: query.keyword,
    },
    {
      enabled: feedMode === "infinite",
    },
  );

  const sourcePosts = useMemo(() => {
    if (feedMode === "infinite") {
      const merged = (infinitePostsQuery.data?.pages || []).flatMap((page) => page.items);
      const dedupedById = new Map<number, Post>();
      merged.forEach((post) => {
        dedupedById.set(post.id, post);
      });
      return Array.from(dedupedById.values());
    }
    return paginationPostsQuery.data?.content || [];
  }, [feedMode, infinitePostsQuery.data?.pages, paginationPostsQuery.data?.content]);

  const filteredPosts = useMemo(() => {
    return sourcePosts.filter((post) => {
      if (selectedCategory === "all") return true;
      return inferCategory(post) === selectedCategory;
    });
  }, [sourcePosts, selectedCategory]);

  const stats = useMemo(() => {
    const totalReadMinutes = sourcePosts.reduce(
      (acc, post) => acc + getReadMinutes(post.content || ""),
      0,
    );
    const totalElements =
      feedMode === "pagination"
        ? paginationPostsQuery.data?.totalElements
        : infinitePostsQuery.data?.pages?.[0]?.totalElements;

    return {
      totalPosts: totalElements ?? sourcePosts.length,
      visiblePosts: filteredPosts.length,
      contributors: new Set(sourcePosts.map((post) => post.userId)).size,
      totalReadMinutes,
      attachments: sourcePosts.filter((post) => (post.attachFiles?.length || 0) > 0).length,
    };
  }, [
    feedMode,
    filteredPosts.length,
    infinitePostsQuery.data?.pages,
    paginationPostsQuery.data?.totalElements,
    sourcePosts,
  ]);

  const handleSearch = () => {
    setQuery((prev) => ({
      ...prev,
      page: 0,
      keyword: searchKeyword.trim() || undefined,
    }));
  };

  const clearSearch = () => {
    setSearchKeyword("");
    setQuery((prev) => ({
      ...prev,
      page: 0,
      keyword: undefined,
    }));
  };

  const changePage = (nextPage: number) => {
    setQuery((prev) => ({ ...prev, page: nextPage }));
  };

  const handleFeedModeChange = (mode: FeedMode) => {
    setFeedMode(mode);
    if (mode === "pagination") {
      setQuery((prev) => ({ ...prev, page: 0 }));
    }
  };

  useEffect(() => {
    if (feedMode !== "infinite") return;
    if (!infinitePostsQuery.hasNextPage || infinitePostsQuery.isFetchingNextPage) return;

    const target = loadMoreTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void infinitePostsQuery.fetchNextPage();
        }
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    feedMode,
    infinitePostsQuery.fetchNextPage,
    infinitePostsQuery.hasNextPage,
    infinitePostsQuery.isFetchingNextPage,
  ]);

  const isLoading =
    feedMode === "infinite" ? infinitePostsQuery.isLoading : paginationPostsQuery.isLoading;
  const error = feedMode === "infinite" ? infinitePostsQuery.error : paginationPostsQuery.error;

  if (isLoading) {
    return (
      <div className="route-enter flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-base font-semibold text-slate-600">피드를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <h2 className="text-xl font-black text-rose-700">피드 로딩 실패</h2>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="route-enter space-y-6">
      <PostFeedHero stats={stats} onPrefetchCreate={() => void preloadCreateFlow()} />

      <PostFeedControls
        searchKeyword={searchKeyword}
        activeKeyword={query.keyword}
        onSearchKeywordChange={setSearchKeyword}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        feedMode={feedMode}
        onFeedModeChange={handleFeedModeChange}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <PostList posts={filteredPosts} viewMode={viewMode} />

      {feedMode === "pagination" &&
        paginationPostsQuery.data &&
        paginationPostsQuery.data.totalPages > 1 && (
        <PostFeedPagination
          totalElements={paginationPostsQuery.data.totalElements}
          pageNumber={paginationPostsQuery.data.pageNumber}
          pageSize={paginationPostsQuery.data.pageSize}
          totalPages={paginationPostsQuery.data.totalPages}
          first={paginationPostsQuery.data.first}
          last={paginationPostsQuery.data.last}
          onPageChange={changePage}
        />
      )}

      {feedMode === "infinite" && (
        <div className="space-y-3">
          <div ref={loadMoreTriggerRef} className="h-2" />

          {infinitePostsQuery.isFetchingNextPage && (
            <p className="text-center text-sm font-semibold text-slate-500">
              게시글을 더 불러오는 중...
            </p>
          )}

          {!infinitePostsQuery.isFetchingNextPage && infinitePostsQuery.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void infinitePostsQuery.fetchNextPage()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                더 보기
              </button>
            </div>
          )}

          {!infinitePostsQuery.hasNextPage && filteredPosts.length > 0 && (
            <p className="text-center text-xs font-semibold text-slate-400">
              모든 게시글을 불러왔습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
