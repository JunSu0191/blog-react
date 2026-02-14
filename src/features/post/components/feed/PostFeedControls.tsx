import { Button, Input, SegmentedControl, SurfaceCard } from "@/shared/ui";

type Category = "all" | "tech" | "daily" | "review";
type ViewMode = "grid" | "list";
type FeedMode = "infinite" | "pagination";

type PostFeedControlsProps = {
  searchKeyword: string;
  activeKeyword?: string;
  onSearchKeywordChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  feedMode: FeedMode;
  onFeedModeChange: (mode: FeedMode) => void;
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
};

const viewModes: Array<{ value: ViewMode; label: string }> = [
  { value: "grid", label: "그리드" },
  { value: "list", label: "리스트" },
];

const feedModes: Array<{ value: FeedMode; label: string }> = [
  { value: "infinite", label: "무한 스크롤" },
  { value: "pagination", label: "페이지" },
];

const categories: Array<{ value: Category; label: string }> = [
  { value: "all", label: "전체" },
  { value: "tech", label: "기술" },
  { value: "daily", label: "일상" },
  { value: "review", label: "리뷰" },
];

export default function PostFeedControls({
  searchKeyword,
  activeKeyword,
  onSearchKeywordChange,
  onSearch,
  onClearSearch,
  viewMode,
  onViewModeChange,
  feedMode,
  onFeedModeChange,
  selectedCategory,
  onCategoryChange,
}: PostFeedControlsProps) {
  return (
    <SurfaceCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Input
            type="text"
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
            placeholder="제목/본문 키워드로 검색"
            className="h-11 rounded-xl border-slate-200 pr-24 dark:border-slate-700"
          />
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            {activeKeyword && (
              <Button
                type="button"
                onClick={onClearSearch}
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 dark:text-slate-300"
              >
                초기화
              </Button>
            )}
            <Button
              type="button"
              onClick={onSearch}
              size="sm"
              className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"
            >
              검색
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SegmentedControl<ViewMode>
            value={viewMode}
            options={viewModes}
            onChange={onViewModeChange}
          />
          <SegmentedControl<FeedMode>
            value={feedMode}
            options={feedModes}
            onChange={onFeedModeChange}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <Button
            key={category.value}
            type="button"
            size="sm"
            variant={selectedCategory === category.value ? "primary" : "outline"}
            onClick={() => onCategoryChange(category.value)}
            className={[
              "h-8 rounded-full px-4 text-sm font-semibold transition-all",
              selectedCategory === category.value
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            ].join(" ")}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {activeKeyword && (
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          검색어: <span className="text-slate-700 dark:text-slate-200">"{activeKeyword}"</span>
        </p>
      )}
    </SurfaceCard>
  );
}
