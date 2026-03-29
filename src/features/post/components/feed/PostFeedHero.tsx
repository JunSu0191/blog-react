import { Link } from "react-router-dom";
import { Button, StatCard, SurfaceCard } from "@/shared/ui";

type FeedStats = {
  totalPosts: number;
  visiblePosts: number;
  contributors: number;
  totalReadMinutes: number;
  attachments: number;
};

type PostFeedHeroProps = {
  stats: FeedStats;
  onPrefetchCreate: () => void;
};

export default function PostFeedHero({ stats, onPrefetchCreate }: PostFeedHeroProps) {
  return (
    <SurfaceCard padded="lg" className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_62%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">BLOG PAUSE FEED</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            오늘의 Blog Pause 스트림
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
            빠르게 탐색하고, 읽고, 바로 작성하는 파워풀한 에디토리얼 허브
          </p>
        </div>

        <Link
          to="/posts/create"
          onMouseEnter={onPrefetchCreate}
          onFocus={onPrefetchCreate}
        >
          <Button className="h-11 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700">
            새 글 작성
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="전체 게시글" value={stats.totalPosts} />
        <StatCard label="현재 필터 결과" value={stats.visiblePosts} />
        <StatCard label="활성 작성자" value={stats.contributors} />
        <StatCard label="예상 읽기 시간" value={`${stats.totalReadMinutes}분`} />
        <StatCard label="첨부 포함 글" value={stats.attachments} />
      </div>
    </SurfaceCard>
  );
}
