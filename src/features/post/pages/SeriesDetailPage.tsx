import { BookMarked, LibraryBig } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/ui";
import PostFeedListItem from "../components/feed/PostFeedListItem";
import { useSeriesDetail } from "../queries";
import { resolvePostPath } from "../utils/postContent";

function formatDate(value?: string) {
  if (!value) return "날짜 정보 없음";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "날짜 정보 없음";

  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SeriesDetailPage() {
  const params = useParams<{ seriesId?: string }>();
  const rawSeriesId = Number(params.seriesId);
  const seriesId =
    Number.isFinite(rawSeriesId) && rawSeriesId > 0 ? rawSeriesId : undefined;
  const seriesQuery = useSeriesDetail(seriesId ?? 0, {
    enabled: typeof seriesId === "number",
  });

  if (typeof seriesId !== "number") {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
        <h1 className="text-xl font-black text-rose-700 dark:text-rose-200">
          유효하지 않은 시리즈입니다.
        </h1>
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
          시리즈 주소를 다시 확인해 주세요.
        </p>
      </div>
    );
  }

  if (seriesQuery.isLoading) {
    return (
      <div className="route-enter flex min-h-[48vh] flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-semibold text-slate-500">시리즈를 불러오는 중...</p>
      </div>
    );
  }

  if (seriesQuery.isError || !seriesQuery.data) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
        <h1 className="text-xl font-black text-rose-700 dark:text-rose-200">
          시리즈를 찾을 수 없습니다.
        </h1>
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
          {seriesQuery.error?.message || "이미 삭제되었거나 존재하지 않는 시리즈입니다."}
        </p>
      </div>
    );
  }

  const series = seriesQuery.data;

  return (
    <div className="route-enter space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(239,246,255,0.96))] p-6 shadow-[0_24px_80px_-56px_rgba(37,99,235,0.42)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.98))] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              <LibraryBig className="h-3.5 w-3.5" />
              Series Archive
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {series.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {series.description || "같은 흐름의 글을 순서대로 읽을 수 있도록 묶은 시리즈입니다."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                총 {series.postCount.toLocaleString()}편
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                업데이트 {formatDate(series.updatedAt || series.createdAt)}
              </span>
            </div>
          </div>

          <Link to="/posts">
            <Button variant="outline" className="rounded-xl">
              글 목록으로
            </Button>
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              시리즈 글 순서
            </h2>
          </div>
        </div>

        {series.posts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            아직 이 시리즈에 연결된 공개 글이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {series.posts.map((post, index) => {
              const order =
                typeof post.series?.order === "number"
                  ? post.series.order
                  : index + 1;

              return (
                <PostFeedListItem
                  key={post.id}
                  post={post}
                  destination={resolvePostPath(post.id)}
                  seriesContext={{ order }}
                  className="group/post transition-all duration-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/20"
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
