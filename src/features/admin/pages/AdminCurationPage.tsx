import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Sparkles, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { Button, SegmentedControl } from "@/shared/ui";
import { readCurationPostIds, writeCurationPostIds } from "@/features/post/utils/curationStorage";
import AdminShell from "../components/AdminShell";
import { useAdminComments, useAdminPosts, useAdminRecentPosts } from "../queries";

type ReviewTab = "recommend" | "review";

export default function AdminCurationPage() {
  const [activeTab, setActiveTab] = useState<ReviewTab>("recommend");
  const [featuredPostIds, setFeaturedPostIds] = useState<number[]>(() => readCurationPostIds());
  const recentPostsQuery = useAdminRecentPosts();
  const reviewPostsQuery = useAdminPosts({
    page: 0,
    size: 6,
    sort: "createdAt,desc",
    deleted: "all",
  });
  const reviewCommentsQuery = useAdminComments({
    page: 0,
    size: 6,
    sort: "createdAt,desc",
    deleted: "all",
  });

  const recentPosts = recentPostsQuery.data?.content ?? [];
  const featuredPosts = useMemo(
    () => recentPosts.filter((post) => featuredPostIds.includes(post.id)),
    [featuredPostIds, recentPosts],
  );

  const toggleFeatured = (postId: number) => {
    setFeaturedPostIds((prev) => {
      const next = prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId].slice(-4);
      writeCurationPostIds(next);
      return next;
    });
  };

  return (
    <AdminShell
      title="추천 / 검수"
      description="메인 추천 슬롯과 검수 대기 흐름을 한 화면에서 정리합니다."
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
              큐레이션 콘솔
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              서버 추천 API가 붙기 전까지는 운영자가 직접 추천 슬롯을 관리할 수 있습니다.
            </p>
          </div>
          <SegmentedControl<ReviewTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "recommend", label: "추천 슬롯" },
              { value: "review", label: "검수 대기" },
            ]}
            className="w-full max-w-[260px]"
          />
        </div>
      </section>

      {activeTab === "recommend" ? (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-blue-600" />
              추천 후보
            </div>
            <div className="mt-4 space-y-3">
              {recentPosts.map((post) => {
                const active = featuredPostIds.includes(post.id);
                return (
                  <div
                    key={post.id}
                    className={[
                      "rounded-2xl border p-4 transition",
                      active
                        ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-black text-slate-900 dark:text-slate-100">
                          {post.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          작성자 {post.authorName || post.username || "-"} · {post.createdAt || "-"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={active ? undefined : "outline"}
                        size="sm"
                        className={active ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                        onClick={() => toggleFeatured(post.id)}
                      >
                        {active ? "추천 해제" : "추천 추가"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              현재 추천 슬롯
            </div>
            <div className="mt-4 space-y-3">
              {featuredPosts.length > 0 ? (
                featuredPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    to={`/posts/${post.id}`}
                    className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Slot {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                          {post.title}
                        </p>
                      </div>
                      <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                        featured
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  아직 추천 슬롯에 담긴 글이 없습니다.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              최근 게시글 검수
            </div>
            <div className="mt-4 space-y-3">
              {(reviewPostsQuery.data?.content ?? []).map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <p className="line-clamp-1 text-sm font-black text-slate-900 dark:text-slate-100">
                    {post.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    작성자 {post.authorName || post.username || "-"} · {post.deletedAt ? "숨김 상태" : "노출 중"}
                  </p>
                  <Link
                    to={`/posts/${post.id}`}
                    className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    원문 보기
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              최근 댓글 검수
            </div>
            <div className="mt-4 space-y-3">
              {(reviewCommentsQuery.data?.content ?? []).map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {comment.content}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {comment.postTitle || "게시글 정보 없음"} · {comment.deletedAt ? "숨김 상태" : "노출 중"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
