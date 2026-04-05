import { Link, useParams } from "react-router-dom";
import { Hash } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Button, TagChip } from "@/shared/ui";
import PostFeedListItem from "../components/feed/PostFeedListItem";
import { usePostFeed } from "../queries";
import { resolvePostPath } from "../utils/postContent";

export default function TagHubPage() {
  const params = useParams<{ tag?: string }>();
  const tag = decodeURIComponent(params.tag ?? "").trim();
  const feedQuery = usePostFeed(
    {
      tag: tag || undefined,
      page: 0,
      size: 20,
    },
    {
      enabled: tag.length > 0,
    },
  );

  const posts = feedQuery.data?.content ?? [];
  const relatedTags = new Map<string, number>();
  posts.forEach((post) => {
    post.tags.forEach((item) => {
      const name = item.name.trim();
      if (!name || name.toLocaleLowerCase() === tag.toLocaleLowerCase()) return;
      relatedTags.set(name, (relatedTags.get(name) ?? 0) + 1);
    });
  });
  const topRelatedTags = [...relatedTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="route-enter space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92)_42%,rgba(224,242,254,0.78))] p-6 shadow-[0_28px_80px_-54px_rgba(37,99,235,0.26)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96)_48%,rgba(30,41,59,0.94))] dark:shadow-[0_32px_90px_-58px_rgba(14,165,233,0.32)] dark:ring-slate-800/70 sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),transparent_66%)] dark:bg-[radial-gradient(circle,rgba(56,189,248,0.2),transparent_68%)]" />
          <div className="absolute left-0 top-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.22),transparent_68%)] dark:bg-[radial-gradient(circle,rgba(37,99,235,0.16),transparent_72%)]" />
          <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.76),transparent_72%)] dark:bg-[radial-gradient(circle,rgba(14,165,233,0.1),transparent_74%)]" />
        </div>

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur dark:border-sky-900/60 dark:bg-slate-900/55 dark:text-blue-300">
              <Hash className="h-3.5 w-3.5" />
              Tag Hub
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                #{tag || "tag"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                같은 태그로 묶인 글들을 한 번에 모아 읽고, 연관 태그로 다시 이동할 수 있습니다.
              </p>
            </div>
          </div>
          <Link to="/search">
            <Button variant="outline" className="rounded-xl">
              검색 허브로 이동
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardContent className="p-5">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                #{tag} 글 {feedQuery.data?.totalElements?.toLocaleString?.() ?? posts.length}개
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                태그 단위로 콘텐츠를 좁혀 보는 탐색 페이지입니다.
              </p>
            </CardContent>
          </Card>

          {posts.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                아직 이 태그와 연결된 글이 없습니다.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {posts.map((post) => (
                  <PostFeedListItem
                    key={post.id}
                    post={post}
                    destination={resolvePostPath(post.id)}
                    className="group/post transition-all duration-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/20"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                연관 태그
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {topRelatedTags.length > 0 ? (
                topRelatedTags.map(([name, count]) => (
                  <Link key={name} to={`/tags/${encodeURIComponent(name)}`}>
                    <TagChip label={name} count={count} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">연관 태그가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
