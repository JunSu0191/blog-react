import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";
import { Button, Input, TagChip } from "@/shared/ui";
import PostFeedListItem from "../components/feed/PostFeedListItem";
import { usePostCategories, usePostFeed } from "../queries";
import { resolvePostPath } from "../utils/postContent";

function normalizeKeyword(value: string) {
  return value.trim();
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keyword = normalizeKeyword(searchParams.get("q") ?? "");
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const feedQuery = usePostFeed(
    {
      q: keyword || undefined,
      page: 0,
      size: 12,
    },
    {
      enabled: keyword.length > 0,
    },
  );
  const categoriesQuery = usePostCategories();

  const posts = feedQuery.data?.content ?? [];
  const hotTags = useMemo(() => {
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
      .slice(0, 10);
  }, [posts]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKeyword = normalizeKeyword(draftKeyword);
    navigate({
      pathname: "/search",
      search: nextKeyword ? `?q=${encodeURIComponent(nextKeyword)}` : "",
    });
  };

  return (
    <div className="route-enter space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(239,246,255,0.98))] p-6 shadow-[0_24px_80px_-56px_rgba(37,99,235,0.42)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.98))] sm:p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            Search Hub
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              찾고 싶은 글을 더 빠르게
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              제목, 요약, 태그 흐름을 기준으로 검색하고 바로 목록 탐색으로 이어질 수 있게 정리한 검색 화면입니다.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={draftKeyword}
              onChange={(event) => setDraftKeyword(event.target.value)}
              placeholder="검색어를 입력해 주세요"
              className="h-11 rounded-xl"
            />
            <Button type="submit" className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
              <Search className="h-4 w-4" />
              검색
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">통합 검색</Badge>
            <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">추천 카테고리</Badge>
            <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">연관 태그</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {keyword ? `"${keyword}" 검색 결과` : "검색을 시작해 보세요"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {keyword
                      ? `총 ${feedQuery.data?.totalElements?.toLocaleString?.() ?? 0}개의 글을 찾았습니다.`
                      : "키워드를 입력하면 관련 글을 바로 보여줍니다."}
                  </p>
                </div>
                <Link
                  to={keyword ? `/posts?q=${encodeURIComponent(keyword)}` : "/posts"}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  목록에서 자세히 보기
                </Link>
              </div>
            </CardContent>
          </Card>

          {!keyword ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                홈에서 발견한 주제를 더 깊게 찾고 싶다면 키워드를 입력해 보세요.
              </CardContent>
            </Card>
          ) : feedQuery.isLoading ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                검색 결과를 불러오는 중...
              </CardContent>
            </Card>
          ) : posts.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                검색 결과가 없습니다. 다른 키워드나 카테고리로 시도해 보세요.
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
                추천 카테고리
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(categoriesQuery.data ?? []).slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                >
                  {category.name}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                연관 태그
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hotTags.length > 0 ? (
                hotTags.map(([name, count]) => (
                  <TagChip key={name} label={name} count={count} />
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  검색 후 연관 태그가 여기에 표시됩니다.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
