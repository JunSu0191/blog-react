import { Button, SurfaceCard } from "@/shared/ui";

type PostFeedPaginationProps = {
  totalElements: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  onPageChange: (page: number) => void;
};

export default function PostFeedPagination({
  totalElements,
  pageNumber,
  pageSize,
  totalPages,
  first,
  last,
  onPageChange,
}: PostFeedPaginationProps) {
  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  const handlePageChange = (nextPage: number) => {
    onPageChange(nextPage);
    scrollToTop();
  };

  return (
    <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" padded="none">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        총 {totalElements}개 중 {pageNumber * pageSize + 1} -{" "}
        {Math.min((pageNumber + 1) * pageSize, totalElements)} 표시
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handlePageChange(pageNumber - 1)}
          disabled={first}
        >
          이전
        </Button>
        <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {pageNumber + 1} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handlePageChange(pageNumber + 1)}
          disabled={last}
        >
          다음
        </Button>
      </div>
    </SurfaceCard>
  );
}
