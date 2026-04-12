import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { resolveDisplayName } from "@/shared/lib/displayName";
import { TagChip, UserAvatar } from "@/shared/ui";
import { resolveSeriesPath } from "../../utils/postContent";

export type FeedPostCardData = {
  id: number;
  title: string;
  subtitle?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  category?: {
    id?: number;
    name?: string;
  } | null;
  tags?: Array<{
    id?: number;
    name: string;
    slug?: string;
  }>;
  author?: {
    id?: number;
    username?: string;
    name?: string;
    nickname?: string;
    profileImageUrl?: string;
  } | null;
  series?: {
    id?: number;
    title: string;
    order?: number;
    postCount?: number;
    slug?: string;
  } | null;
  readTimeMinutes?: number;
  viewCount?: number;
  likeCount?: number;
  publishedAt?: string;
  createdAt?: string;
};

type PostFeedListItemProps = {
  post: FeedPostCardData;
  destination: string;
  showEngagementStats?: boolean;
  className?: string;
  seriesContext?: {
    order: number;
  };
};

function formatPostDate(value?: string) {
  if (!value) return "날짜 정보 없음";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "날짜 정보 없음";

  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeTime(value?: string) {
  if (!value) return "시간 정보 없음";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "시간 정보 없음";

  const now = Date.now();
  const diffMs = now - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "방금 전";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}일 전`;

  return formatPostDate(value);
}

function resolveAuthorName(post: FeedPostCardData) {
  return resolveDisplayName(post.author || {}, "익명");
}

function resolveAuthorProfilePath(post: FeedPostCardData) {
  const username = post.author?.username?.trim();
  if (username) return `/${encodeURIComponent(username)}`;
  return null;
}

function resolvePostImages(post: FeedPostCardData) {
  const imageUrls = Array.isArray(post.imageUrls) ? post.imageUrls : [];
  if (imageUrls.length > 0) return imageUrls;
  if (post.thumbnailUrl) return [post.thumbnailUrl];
  return [];
}

type MobilePostImageCarouselProps = {
  images: string[];
  title: string;
};

function MobilePostImageCarousel({ images, title }: MobilePostImageCarouselProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex >= images.length - 1;

  useEffect(() => {
    if (!carouselApi) return;

    const syncIndex = () => {
      setActiveIndex(carouselApi.selectedScrollSnap());
    };

    syncIndex();
    carouselApi.on("select", syncIndex);
    carouselApi.on("reInit", syncIndex);

    return () => {
      carouselApi.off("select", syncIndex);
      carouselApi.off("reInit", syncIndex);
    };
  }, [carouselApi]);

  if (images.length === 0) {
    return (
      <div className="sm:hidden">
        <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="relative sm:hidden [touch-action:pan-y]">
      <Carousel
        opts={{
          align: "start",
          containScroll: "trimSnaps",
          loop: false,
          dragFree: false,
          dragThreshold: 14,
        }}
        setApi={setCarouselApi}
      >
        <CarouselContent className="-ml-2">
          {images.map((imageUrl, index) => (
            <CarouselItem
              key={`${imageUrl}-${index}`}
              className="basis-[95%] pl-2"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                <img
                  src={imageUrl}
                  alt={`${title} 이미지 ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div
        className={[
          "pointer-events-none absolute bottom-2.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-[1px]",
          isLastSlide ? "right-4" : "right-6",
        ].join(" ")}
      >
        {Math.min(activeIndex + 1, images.length)}/{images.length}
      </div>
    </div>
  );
}

type DesktopPostImagePreviewProps = {
  images: string[];
  title: string;
};

function DesktopPostImagePreview({ images, title }: DesktopPostImagePreviewProps) {
  if (images.length === 0) {
    return null;
  }

  const primaryImage = images[0];
  const extraImages = images.slice(1, 5);
  const hiddenCount = Math.max(0, images.length - 1 - extraImages.length);

  return (
    <div className="group/preview relative hidden overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 sm:block sm:self-stretch">
      <img
        src={primaryImage}
        alt={title}
        className="h-48 w-full object-cover transition-transform duration-300 ease-out group-hover/preview:scale-[1.04] sm:h-full"
        loading="lazy"
      />
      {extraImages.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 bg-slate-950/45 p-2 opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100">
          <div className="grid h-full grid-cols-2 gap-2">
            {extraImages.map((imageUrl, index) => {
              const isLastPreview = index === extraImages.length - 1;
              const shouldShowHiddenCount = hiddenCount > 0 && isLastPreview;

              return (
                <div
                  key={`${imageUrl}-${index}`}
                  className="relative overflow-hidden rounded-md"
                >
                  <img
                    src={imageUrl}
                    alt={`${title} 추가 이미지 ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {shouldShowHiddenCount ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">
                      +{hiddenCount}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PostFeedListItem({
  post,
  destination,
  showEngagementStats = true,
  className,
  seriesContext,
}: PostFeedListItemProps) {
  const postImages = resolvePostImages(post);
  const hasImages = postImages.length > 0;
  const publishedDate = post.publishedAt || post.createdAt;
  const authorName = resolveAuthorName(post);
  const authorBlogPath = resolveAuthorProfilePath(post);
  const rowHoverClass =
    "group/post transition-all duration-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-400/60 hover:bg-blue-50/80 hover:shadow-sm dark:hover:bg-blue-950/20";
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const readTimeMinutes =
    typeof post.readTimeMinutes === "number" && Number.isFinite(post.readTimeMinutes)
      ? post.readTimeMinutes
      : 0;
  const viewCount =
    typeof post.viewCount === "number" && Number.isFinite(post.viewCount)
      ? post.viewCount
      : 0;
  const likeCount =
    typeof post.likeCount === "number" && Number.isFinite(post.likeCount)
      ? post.likeCount
      : 0;

  return (
    <article className={className || rowHoverClass}>
      <div
        className={[
          "grid gap-4 p-4 sm:p-5",
          hasImages
            ? "sm:grid-cols-[minmax(0,1fr)_250px]"
            : "sm:grid-cols-1",
        ].join(" ")}
      >
        <div className="min-w-0 space-y-3">
          {seriesContext ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-2 font-black text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                {seriesContext.order}
              </span>
              <span className="font-semibold text-slate-500 dark:text-slate-400">
                시리즈 순서
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar
                name={authorName}
                imageUrl={post.author?.profileImageUrl}
                alt={`${authorName} 프로필`}
                className="h-9 w-9 border border-slate-200 dark:border-slate-700"
                fallbackClassName="text-sm font-bold"
              />

              <div className="min-w-0">
                {authorBlogPath ? (
                  <Link
                    to={authorBlogPath}
                    className="line-clamp-1 text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100"
                  >
                    {authorName}
                  </Link>
                ) : (
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {authorName}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeTime(publishedDate)}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {readTimeMinutes}분 읽기
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            <span>{post.category?.name || "미분류"}</span>
            <span>·</span>
            <span>{formatPostDate(publishedDate)}</span>
          </div>

          {post.series?.title ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {typeof post.series.id === "number" ? (
                <Link
                  to={resolveSeriesPath(post.series.id)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                  {post.series.title}
                </Link>
              ) : (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300">
                  {post.series.title}
                </span>
              )}
              {typeof post.series.order === "number" ? (
                <span className="text-slate-500 dark:text-slate-400">
                  {post.series.order}편
                </span>
              ) : null}
            </div>
          ) : null}

          <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900 transition-colors group-hover/post:text-blue-700 dark:text-slate-100 dark:group-hover/post:text-blue-300 sm:text-2xl">
            <Link
              to={destination}
              className="decoration-blue-500/60 underline-offset-4 hover:underline focus-visible:underline"
            >
              {post.title}
            </Link>
          </h2>

          {post.subtitle ? (
            <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
              <Link
                to={destination}
                className="underline-offset-4 hover:underline"
              >
                {post.subtitle}
              </Link>
            </p>
          ) : null}

          {post.excerpt ? (
            <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
              <Link
                to={destination}
                className="underline-offset-4 hover:underline"
              >
                {post.excerpt}
              </Link>
            </p>
          ) : null}

          {showEngagementStats ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              조회 {viewCount.toLocaleString()} · 공감 {likeCount.toLocaleString()}
            </p>
          ) : null}

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.slice(0, 4).map((tag) => (
                <TagChip key={`${post.id}-${tag.name}`} label={tag.name} />
              ))}
            </div>
          ) : null}

          {hasImages ? (
            <MobilePostImageCarousel images={postImages} title={post.title} />
          ) : (
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 sm:hidden">
              텍스트 중심 글
            </p>
          )}
        </div>

        {hasImages ? (
          <DesktopPostImagePreview images={postImages} title={post.title} />
        ) : (
          <p className="hidden text-xs font-semibold text-slate-400 dark:text-slate-500 sm:block">
            텍스트 중심 글
          </p>
        )}
      </div>
    </article>
  );
}
