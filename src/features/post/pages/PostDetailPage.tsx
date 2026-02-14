import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button } from "@/shared/ui";
import { CommentList } from "@/features/comment";
import { usePost } from "../queries";
import { API_BASE_URL } from "@/shared/lib/api";
import { toApiAbsoluteUrl } from "@/shared/lib/networkRuntime";

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const readingMinutes = (content: string) => {
  const charsPerMinute = 450;
  return Math.max(1, Math.ceil(stripHtml(content).length / charsPerMinute));
};

const formatDate = (raw?: string) => {
  if (!raw) return "날짜 없음";
  return new Date(raw).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const toDownloadUrl = (rawUrl?: string) => {
  if (!rawUrl) return "";
  return toApiAbsoluteUrl(rawUrl, API_BASE_URL);
};

const sharePost = async (title: string, url: string) => {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("링크를 클립보드에 복사했습니다.");
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("cancel"))) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("링크를 클립보드에 복사했습니다.");
    } catch {
      alert(`공유에 실패했습니다. 수동으로 복사해주세요:\n${url}`);
    }
  }
};

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const postId = id ? Number(id) : null;

  if (!postId || Number.isNaN(postId)) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <h2 className="text-xl font-black text-rose-700">잘못된 게시글 ID</h2>
        <p className="mt-2 text-sm text-rose-600">요청한 게시글 주소를 다시 확인해 주세요.</p>
      </div>
    );
  }

  const { data: post, isLoading, error } = usePost(postId);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const plainSummary = useMemo(() => {
    if (!post) return "";
    return stripHtml(post.content).slice(0, 120);
  }, [post]);

  if (isLoading) {
    return (
      <div className="route-enter flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-base font-semibold text-slate-600">게시글을 불러오는 중...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <h2 className="text-xl font-black text-rose-700">게시글을 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm text-rose-600">요청한 글이 삭제되었거나 존재하지 않습니다.</p>
        <Link to="/posts" className="mt-5 inline-flex">
          <Button>목록으로 이동</Button>
        </Link>
      </div>
    );
  }

  const readTime = readingMinutes(post.content || "");

  return (
    <article className="route-enter space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_26px_70px_-46px_rgba(15,23,42,0.7)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/posts"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            ← 목록으로
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBookmarked((prev) => !prev)}
              className={[
                "rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
                isBookmarked
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              {isBookmarked ? "북마크됨" : "북마크"}
            </button>
            <button
              type="button"
              onClick={() => void sharePost(post.title, window.location.href)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              공유
            </button>
          </div>
        </div>

        <h1 className="mt-6 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {post.title}
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{plainSummary}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">작성자</p>
            <p className="mt-1 text-sm font-bold text-slate-900">User {post.userId}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">작성일</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatDate(post.createdAt)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">예상 읽기</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{readTime}분</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">첨부</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{post.attachFiles?.length || 0}개</p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_62px_-46px_rgba(15,23,42,0.75)]">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-700">본문</h2>
        </div>
        <div className="toss-editor-content prose prose-slate max-w-none px-6 py-6 sm:px-10 sm:py-10">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      </section>

      {post.attachFiles && post.attachFiles.length > 0 && (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_58px_-46px_rgba(15,23,42,0.6)]">
          <h2 className="text-xl font-black tracking-tight text-slate-900">첨부 파일</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {post.attachFiles.map((file) => {
              const downloadUrl = toDownloadUrl(file.url);
              const hasUrl = downloadUrl.length > 0;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{file.filename || "첨부파일"}</p>
                    <p className="text-xs text-slate-500">파일 다운로드</p>
                  </div>
                  {hasUrl ? (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.filename}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      다운로드
                    </a>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
                      URL 없음
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_58px_-46px_rgba(15,23,42,0.6)]">
        <h2 className="text-xl font-black tracking-tight text-slate-900">댓글</h2>
        <div className="mt-4">
          <CommentList postId={postId} />
        </div>
      </section>
    </article>
  );
}
