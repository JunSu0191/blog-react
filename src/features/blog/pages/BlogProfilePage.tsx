import { Globe, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ApiError } from "@/shared/lib/api";
import { Button, Input, Select } from "@/shared/ui";
import PostFeedListItem, {
  type FeedPostCardData,
} from "@/features/post/components/feed/PostFeedListItem";
import { resolvePostPath } from "@/features/post/utils/postContent";
import { useBlogProfile, useInfiniteBlogProfile } from "../queries";
import type {
  BlogFontScale,
  BlogPostSort,
  BlogProfileLayout,
  BlogThemePreset,
} from "../types";

const PAGE_SIZE = 10;

const SORT_OPTIONS: Array<{ value: BlogPostSort; label: string }> = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
];

const PRESET_THEME_CLASS: Record<
  BlogThemePreset,
  {
    surface: string;
    cover: string;
    badge: string;
  }
> = {
  minimal: {
    surface:
      "bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900",
    cover:
      "bg-gradient-to-r from-slate-200 via-slate-100 to-white dark:from-slate-800 dark:via-slate-700 dark:to-slate-900",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  ocean: {
    surface:
      "bg-gradient-to-b from-cyan-50 via-sky-50 to-white dark:from-cyan-950/30 dark:via-slate-900 dark:to-slate-900",
    cover:
      "bg-gradient-to-r from-cyan-300/70 via-sky-200/70 to-indigo-100 dark:from-cyan-700/60 dark:via-sky-700/50 dark:to-slate-900",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  },
  sunset: {
    surface:
      "bg-gradient-to-b from-orange-50 via-rose-50 to-white dark:from-orange-950/30 dark:via-rose-950/20 dark:to-slate-900",
    cover:
      "bg-gradient-to-r from-orange-300/70 via-rose-300/60 to-yellow-100 dark:from-orange-700/60 dark:via-rose-700/50 dark:to-slate-900",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  },
  forest: {
    surface:
      "bg-gradient-to-b from-emerald-50 via-lime-50 to-white dark:from-emerald-950/30 dark:via-lime-950/20 dark:to-slate-900",
    cover:
      "bg-gradient-to-r from-emerald-300/70 via-lime-200/70 to-green-100 dark:from-emerald-700/60 dark:via-lime-700/40 dark:to-slate-900",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
};

const FONT_SCALE_CLASS: Record<BlogFontScale, string> = {
  sm: "text-[0.95rem]",
  md: "text-base",
  lg: "text-[1.05rem]",
};

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveErrorCode(error: ApiError | null | undefined) {
  if (!error || !error.data || typeof error.data !== "object") return null;

  const root = error.data as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;

  return toText(root.code) || toText(nested?.code);
}

function isBlogProfileNotFound(error: ApiError | null | undefined) {
  if (!error) return false;
  const status = String(error.status ?? "");
  if (status !== "404") return false;

  const code = resolveErrorCode(error);
  return code === null || code === "blog_profile_not_found";
}

function resolveProfileName(
  displayName?: string,
  name?: string,
  nickname?: string,
  username?: string,
) {
  return displayName || name || nickname || username || "Unknown";
}

function normalizeThemePreset(value: string): BlogThemePreset {
  if (value === "ocean" || value === "sunset" || value === "forest") {
    return value;
  }
  return "minimal";
}

function normalizeProfileLayout(value: string): BlogProfileLayout {
  if (value === "compact" || value === "centered") return value;
  return "default";
}

function normalizeFontScale(value: string): BlogFontScale {
  if (value === "sm" || value === "lg") return value;
  return "md";
}

export default function BlogProfilePage() {
  const { username: rawUsername } = useParams();
  const username = (rawUsername ?? "").trim();
  const isMobile = useIsMobile();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sort, setSort] = useState<BlogPostSort>("latest");
  const [page, setPage] = useState(0);

  const desktopQuery = useBlogProfile(
    username,
    {
      q: searchKeyword || undefined,
      sort,
      page,
      size: PAGE_SIZE,
    },
    { enabled: Boolean(username) && !isMobile },
  );

  const mobileQuery = useInfiniteBlogProfile(
    username,
    {
      q: searchKeyword || undefined,
      sort,
      size: PAGE_SIZE,
    },
    { enabled: Boolean(username) && isMobile },
  );

  const mobilePages = mobileQuery.data?.pages ?? [];
  const profileData = isMobile ? mobilePages[0] : desktopQuery.data;
  const posts = useMemo(() => {
    if (isMobile) {
      return mobilePages.flatMap((pageData) => pageData.posts.content);
    }
    return desktopQuery.data?.posts.content ?? [];
  }, [desktopQuery.data?.posts.content, isMobile, mobilePages]);

  const activePostsPage = isMobile
    ? mobilePages[mobilePages.length - 1]?.posts
    : desktopQuery.data?.posts;

  const totalElements = activePostsPage?.totalElements ?? posts.length;
  const totalPages = activePostsPage?.totalPages ?? 1;
  const canMovePrev = page > 0;
  const canMoveNext = page + 1 < totalPages;
  const isLoading = isMobile ? mobileQuery.isLoading : desktopQuery.isLoading;
  const activeError = isMobile ? mobileQuery.error : desktopQuery.error;
  const isNotFound = isBlogProfileNotFound(activeError ?? null);
  const refetchProfile = isMobile
    ? () => mobileQuery.refetch()
    : () => desktopQuery.refetch();

  useEffect(() => {
    setPage(0);
  }, [searchKeyword, sort]);

  useEffect(() => {
    if (!isMobile) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!mobileQuery.hasNextPage || mobileQuery.isFetchingNextPage) return;
        void mobileQuery.fetchNextPage();
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [
    isMobile,
    mobileQuery.fetchNextPage,
    mobileQuery.hasNextPage,
    mobileQuery.isFetchingNextPage,
  ]);

  if (!username) {
    return (
      <div className="route-enter rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-semibold text-rose-700">유효한 사용자 경로가 아닙니다.</p>
      </div>
    );
  }

  if (isLoading && !profileData) {
    return (
      <div className="route-enter flex min-h-[42vh] flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-semibold text-slate-500">블로그를 불러오는 중...</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="route-enter rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">존재하지 않는 블로그</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          요청하신 블로그를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  if (activeError && !profileData) {
    return (
      <div className="route-enter rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/70 dark:bg-rose-950/20">
        <h1 className="text-lg font-bold text-rose-700 dark:text-rose-200">
          블로그 정보를 불러오지 못했습니다.
        </h1>
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{activeError.message}</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            void refetchProfile();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  const profileName = resolveProfileName(
    profileData.profile.displayName,
    profileData.user.name,
    profileData.user.nickname,
    profileData.user.username,
  );

  const avatarInitial = profileName.slice(0, 1).toUpperCase();
  const themePreset = normalizeThemePreset(profileData.blogSettings.themePreset);
  const profileLayout = normalizeProfileLayout(profileData.blogSettings.profileLayout);
  const fontScale = normalizeFontScale(profileData.blogSettings.fontScale);
  const showStats = profileData.blogSettings.showStats;
  const themeAccentColor = profileData.blogSettings.accentColor || "#2563eb";
  const themeClass = PRESET_THEME_CLASS[themePreset];
  const pageScaleClass = FONT_SCALE_CLASS[fontScale];
  const pageStyle = {
    "--blog-accent": themeAccentColor,
  } as CSSProperties;

  const isCenteredLayout = profileLayout === "centered";
  const isCompactLayout = profileLayout === "compact";
  const profileAuthor = {
    id: profileData.user.userId,
    username: profileData.user.username,
    name: profileData.user.name,
    nickname: profileData.user.nickname,
    profileImageUrl: profileData.profile.avatarUrl,
  };

  return (
    <div className={`route-enter space-y-4 pt-2 sm:pt-0 ${pageScaleClass}`} style={pageStyle}>
      <section
        className={[
          "rounded-2xl border border-slate-200 p-5 dark:border-slate-700 sm:p-6",
          themeClass.surface,
        ].join(" ")}
      >
        <div
          className={[
            "flex flex-col gap-4",
            isCenteredLayout
              ? "items-center text-center"
              : "sm:flex-row sm:items-start sm:justify-between",
          ].join(" ")}
        >
          <div
            className={[
              "flex min-w-0 items-start gap-3",
              isCenteredLayout ? "flex-col items-center" : "",
            ].join(" ")}
          >
            {profileData.profile.avatarUrl ? (
              <img
                src={profileData.profile.avatarUrl}
                alt={`${profileName} 아바타`}
                className={[
                  "shrink-0 rounded-full border-2 border-white object-cover shadow-sm dark:border-slate-700",
                  isCompactLayout ? "h-14 w-14" : "h-16 w-16",
                ].join(" ")}
              />
            ) : (
              <div
                className={[
                  "inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-sm",
                  isCompactLayout ? "h-14 w-14 text-lg" : "h-16 w-16 text-xl",
                ].join(" ")}
                style={{ backgroundColor: "var(--blog-accent)" }}
              >
                {avatarInitial}
              </div>
            )}

            <div className={isCenteredLayout ? "text-center" : "min-w-0"}>
              <h1
                className={["line-clamp-1 font-black", isCompactLayout ? "text-lg" : "text-xl"].join(" ")}
                style={{ color: "var(--blog-accent)" }}
              >
                {profileName}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                @{profileData.user.username}
              </p>

              <div className="mt-2">
                <span
                  className={[
                    "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                    themeClass.badge,
                  ].join(" ")}
                >
                  THEME · {themePreset.toUpperCase()}
                </span>
              </div>

              {profileData.profile.bio ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {profileData.profile.bio}
                </p>
              ) : null}

              <div
                className={[
                  "mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400",
                  isCenteredLayout ? "justify-center" : "",
                ].join(" ")}
              >
                {profileData.profile.websiteUrl ? (
                  <a
                    href={profileData.profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {profileData.profile.websiteUrl}
                  </a>
                ) : null}
                {profileData.profile.location ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5" />
                    {profileData.profile.location}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {showStats ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">발행 글 수</p>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                {profileData.stats.publishedPostCount.toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full gap-2 sm:max-w-lg">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="게시글 검색"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                setSearchKeyword(searchInput.trim());
              }}
            />
            <Button
              type="button"
              className="shrink-0 border-0 text-white"
              style={{ backgroundColor: "var(--blog-accent)" }}
              onClick={() => {
                setSearchKeyword(searchInput.trim());
              }}
            >
              검색
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-[140px]">
              <Select
                value={sort}
                options={SORT_OPTIONS}
                onValueChange={(value) => {
                  setSort(value as BlogPostSort);
                }}
              />
            </div>
            {searchKeyword ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  setSearchKeyword("");
                }}
              >
                초기화
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">공개 게시글</h2>
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
        </div>

        {posts.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              작성한 게시글이 없습니다
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              첫 게시글이 발행되면 이곳에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {posts.map((post) => {
              const destination = resolvePostPath(post.id);
              const normalizedPost: FeedPostCardData = {
                id: post.id,
                title: post.title,
                subtitle: post.subtitle,
                excerpt: post.excerpt,
                thumbnailUrl: post.thumbnailUrl,
                imageUrls: post.thumbnailUrl ? [post.thumbnailUrl] : [],
                category: post.category,
                tags: post.tags,
                author: profileAuthor,
                readTimeMinutes: post.readTimeMinutes,
                viewCount: post.viewCount,
                likeCount: post.likeCount,
                publishedAt: post.publishedAt,
                createdAt: post.createdAt,
              };

              return (
                <PostFeedListItem
                  key={post.id}
                  post={normalizedPost}
                  destination={destination}
                  showEngagementStats={showStats}
                />
              );
            })}
          </div>
        )}
      </section>

      {!isMobile && posts.length > 0 ? (
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

      {isMobile && posts.length > 0 ? (
        <div ref={loadMoreRef} className="py-2 text-center">
          {mobileQuery.isFetchingNextPage ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              게시글을 더 불러오는 중...
            </p>
          ) : mobileQuery.hasNextPage ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              아래로 스크롤하면 다음 게시글을 불러옵니다.
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              마지막 게시글까지 확인했습니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
