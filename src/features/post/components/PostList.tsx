import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { preloadPostDetailPage } from "@/app/routePreload";
import { PostCard } from "./PostCard";
import { getPost, type Post } from "../api";

type ViewMode = "list" | "grid";

interface PostListProps {
  posts: Post[];
  viewMode?: ViewMode;
}

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const formatDate = (raw?: string) => {
  if (!raw) return "날짜 없음";
  return new Date(raw).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function PostList({ posts, viewMode = "list" }: PostListProps) {
  const queryClient = useQueryClient();

  const handlePrefetchDetail = (postId: number) => {
    preloadPostDetailPage();
    void queryClient.prefetchQuery({
      queryKey: ["posts", postId],
      queryFn: () => getPost(postId),
      staleTime: 60_000,
    });
  };

  if (!posts || posts.length === 0) {
    return (
      <div className="card-reveal rounded-3xl border border-dashed border-slate-300 bg-white/90 p-16 text-center">
        <p className="text-xl font-bold text-slate-700">아직 게시글이 없습니다.</p>
        <p className="mt-2 text-sm text-slate-500">첫 글을 작성해 피드를 채워보세요.</p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-3">
        {posts.map((post, index) => (
          <Link
            key={post.id}
            to={`/posts/${post.id}`}
            className="block"
            onMouseEnter={() => handlePrefetchDetail(post.id)}
            onFocus={() => handlePrefetchDetail(post.id)}
          >
            <article
              className="card-reveal group rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-base font-extrabold text-slate-900 transition-colors group-hover:text-blue-700">
                    {post.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {stripHtml(post.content).slice(0, 180) || "본문 미리보기가 없습니다."}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {formatDate(post.createdAt)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">작성자 {post.userId}</span>
                {(post.attachFiles?.length || 0) > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                    첨부 {post.attachFiles?.length}
                  </span>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          index={index}
          onPrefetch={handlePrefetchDetail}
        />
      ))}
    </div>
  );
}
