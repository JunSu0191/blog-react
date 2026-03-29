import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Compass, LibraryBig, Sparkles, Tags, TrendingUp } from "lucide-react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";
import { Button, TagChip } from "@/shared/ui";
import PostFeedListItem from "../components/feed/PostFeedListItem";
import { usePostCategories, usePostFeed } from "../queries";
import { readCurationPostIds } from "../utils/curationStorage";
import { resolvePostPath } from "../utils/postContent";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export default function HomePage() {
  const feedQuery = usePostFeed({ page: 0, size: 12 });
  const categoriesQuery = usePostCategories();
  const [curationPostIds, setCurationPostIds] = useState<number[]>([]);

  const posts = feedQuery.data?.content ?? [];
  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    setCurationPostIds(readCurationPostIds());

    const handleFocus = () => {
      setCurationPostIds(readCurationPostIds());
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const featuredPosts = useMemo(() => {
    const curated = curationPostIds
      .map((id) => posts.find((post) => post.id === id))
      .filter((item): item is (typeof posts)[number] => Boolean(item));

    if (curated.length > 0) {
      return curated.slice(0, 3);
    }

    return [...posts]
      .sort((a, b) => {
        if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        return b.viewCount - a.viewCount;
      })
      .slice(0, 3);
  }, [curationPostIds, posts]);

  const latestPosts = posts.slice(0, 4);

  const hotTags = (() => {
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
      .slice(0, 8);
  })();

  const spotlightAuthors = (() => {
    const authorMap = new Map<
      string,
      { name: string; username?: string; score: number; articleCount: number }
    >();

    posts.forEach((post) => {
      const authorName =
        post.author?.nickname || post.author?.name || post.author?.username;
      if (!authorName) return;
      const key = post.author?.username || authorName;
      const previous = authorMap.get(key);
      const nextScore = (previous?.score ?? 0) + post.likeCount + post.viewCount;
      authorMap.set(key, {
        name: authorName,
        username: post.author?.username,
        score: nextScore,
        articleCount: (previous?.articleCount ?? 0) + 1,
      });
    });

    return [...authorMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  })();

  return (
    <div className="route-enter space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.20),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.18),_transparent_22%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(239,246,255,0.96))] p-6 shadow-[0_32px_90px_-56px_rgba(37,99,235,0.38)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_18%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.98))] sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              Blog Pause Home
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                더 찾기 쉽고,
                <br />
                더 읽기 좋은 콘텐츠 홈
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                현재 블로그의 방향을 유지하면서도 추천, 카테고리, 태그, 작가 발견 흐름을 강화한 시작 화면입니다.
                이제 글 목록은 탐색에 집중하고, 홈은 추천과 발견을 돕는 허브 역할을 맡습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">추천 글</Badge>
              <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">카테고리 탐색</Badge>
              <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">인기 태그</Badge>
              <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">블로그 발견</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/posts">
              <Button variant="outline" className="rounded-xl">
                전체 글 보기
              </Button>
            </Link>
            <Link to="/posts/create">
              <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                글 쓰기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              오늘의 추천
              {curationPostIds.length > 0 ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  운영자 추천
                </span>
              ) : null}
            </div>
            {feedQuery.isLoading ? (
              <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                추천 글을 불러오는 중...
              </div>
            ) : featuredPosts.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-3">
                {featuredPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    to={resolvePostPath(post.id)}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <div className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-black text-white">
                      {index + 1}
                    </div>
                    <p className="mt-3 line-clamp-2 text-lg font-black tracking-tight text-slate-950 transition group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
                      {post.title}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {post.subtitle || post.excerpt || "추천 이유와 핵심 내용을 빠르게 읽을 수 있도록 요약을 노출합니다."}
                    </p>
                    <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                      좋아요 {formatCount(post.likeCount)} · 조회 {formatCount(post.viewCount)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                추천 글 데이터가 아직 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <Compass className="h-4 w-4 text-blue-600" />
              카테고리 탐색
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {categoriesQuery.isLoading ? (
              <div className="col-span-full rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                카테고리를 불러오는 중...
              </div>
            ) : categories.length > 0 ? (
              categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                    <LibraryBig className="h-3.5 w-3.5" />
                    Category
                  </div>
                  <p className="mt-3 text-base font-black text-slate-950 dark:text-slate-50">
                    {category.name}
                  </p>
                </Link>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                카테고리 데이터가 아직 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">최신 글</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                홈에서는 최신 글 일부만 보여주고, 전체 탐색은 목록으로 넘깁니다.
              </p>
            </div>
            <Link to="/posts" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
              전체 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {latestPosts.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {latestPosts.map((post) => (
                  <PostFeedListItem
                    key={post.id}
                    post={post}
                    destination={resolvePostPath(post.id)}
                    className="group/post transition-all duration-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/20"
                  />
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                최신 글을 불러오는 중이거나 아직 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                <Tags className="h-4 w-4 text-blue-600" />
                인기 태그
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hotTags.length > 0 ? (
                hotTags.map(([name, count]) => (
                  <Link key={name} to={`/tags/${encodeURIComponent(name)}`}>
                    <TagChip label={name} count={count} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  태그 데이터가 아직 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                <Sparkles className="h-4 w-4 text-blue-600" />
                주목할 블로그
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {spotlightAuthors.length > 0 ? (
                spotlightAuthors.map((author) => (
                  <Link
                    key={author.username || author.name}
                    to={author.username ? `/${encodeURIComponent(author.username)}` : "/posts"}
                    className="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-800 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {author.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      게시글 {author.articleCount}개 · 주목도 {formatCount(author.score)}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  작가 데이터를 아직 집계하지 못했습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
