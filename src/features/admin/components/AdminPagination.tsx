import { Button } from "@/shared/ui";

type AdminPaginationProps = {
  pageNumber: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export default function AdminPagination({
  pageNumber,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  disabled = false,
}: AdminPaginationProps) {
  const currentPage = Math.max(0, pageNumber);
  const hasPrev = currentPage > 0;
  const hasNext = currentPage + 1 < Math.max(1, totalPages);

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
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        총 {totalElements.toLocaleString()}건 · 페이지 {currentPage + 1} /{" "}
        {Math.max(1, totalPages)} · 페이지당 {pageSize}건
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrev || disabled}
          onClick={() => handlePageChange(currentPage - 1)}
          aria-label="이전 페이지"
        >
          이전
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNext || disabled}
          onClick={() => handlePageChange(currentPage + 1)}
          aria-label="다음 페이지"
        >
          다음
        </Button>
      </div>
    </div>
  );
}
