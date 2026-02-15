import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, PencilLine, UserRound } from "lucide-react";
import { Button, Input, SegmentedControl, StatCard, SurfaceCard } from "@/shared/ui";
import { showErrorToast } from "@/shared/lib/errorToast";
import { useMyPage } from "../hooks/useMyPage";
import type { MyPageProfileUpdateRequest } from "../types";

type ActiveTab = "posts" | "comments";

function formatDate(raw?: string) {
  if (!raw) return "날짜 없음";
  return new Date(raw).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toPlainText(content?: string) {
  if (!content) return "";

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(content, "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function MyPage() {
  const {
    summary,
    posts,
    comments,
    isLoading,
    isError,
    errors,
    updateProfile,
    isUpdatingProfile,
  } = useMyPage();
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<MyPageProfileUpdateRequest>({
    name: "",
    displayName: "",
    bio: "",
    avatarUrl: "",
    websiteUrl: "",
    location: "",
  });
  const avatarLabel = summary?.profile.displayName || summary?.name || summary?.username || "U";

  useEffect(() => {
    if (!summary || isEditingProfile) return;
    setProfileForm({
      name: summary.name || "",
      displayName: summary.profile.displayName || "",
      bio: summary.profile.bio || "",
      avatarUrl: summary.profile.avatarUrl || "",
      websiteUrl: summary.profile.websiteUrl || "",
      location: summary.profile.location || "",
    });
  }, [isEditingProfile, summary]);

  const errorMessage = useMemo(() => {
    return (
      errors.summary?.message ||
      errors.posts?.message ||
      errors.comments?.message ||
      "마이페이지 데이터를 불러오지 못했습니다."
    );
  }, [errors.comments?.message, errors.posts?.message, errors.summary?.message]);

  const handleProfileFieldChange = (
    key: keyof MyPageProfileUpdateRequest,
    value: string,
  ) => {
    setProfileForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      showErrorToast(null, "이름은 필수입니다.");
      return;
    }

    try {
      await updateProfile({
        name: profileForm.name.trim(),
        displayName: profileForm.displayName?.trim() || null,
        bio: profileForm.bio?.trim() || null,
        avatarUrl: profileForm.avatarUrl?.trim() || null,
        websiteUrl: profileForm.websiteUrl?.trim() || null,
        location: profileForm.location?.trim() || null,
      });
      setIsEditingProfile(false);
    } catch {
      // 에러 토스트는 hook 레벨에서 처리.
    }
  };

  const handleCancelEdit = () => {
    if (!summary) return;
    setProfileForm({
      name: summary.name || "",
      displayName: summary.profile.displayName || "",
      bio: summary.profile.bio || "",
      avatarUrl: summary.profile.avatarUrl || "",
      websiteUrl: summary.profile.websiteUrl || "",
      location: summary.profile.location || "",
    });
    setIsEditingProfile(false);
  };

  if (isLoading) {
    return (
      <div className="route-enter flex min-h-[48vh] flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-semibold text-slate-500">마이페이지 로딩 중...</p>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="route-enter space-y-4 sm:space-y-5">
      <SurfaceCard className="rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {summary.profile.avatarUrl ? (
              <img
                src={summary.profile.avatarUrl}
                alt={`${avatarLabel} 아바타`}
                className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
                {avatarLabel.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-1 text-xl font-black text-slate-900 dark:text-slate-100">
                {summary.name}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                @{summary.username}
              </p>
              {summary.profile.displayName && (
                <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {summary.profile.displayName}
                </p>
              )}
              {summary.profile.bio && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {summary.profile.bio}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {summary.profile.websiteUrl && (
                  <a
                    href={summary.profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {summary.profile.websiteUrl}
                  </a>
                )}
                {summary.profile.location && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5" />
                    {summary.profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!isEditingProfile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setIsEditingProfile(true)}
            >
              <PencilLine className="h-4 w-4" />
              프로필 수정
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isUpdatingProfile}
                className="rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void handleSaveProfile();
                }}
                isLoading={isUpdatingProfile}
                loadingText="저장 중..."
                className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                저장
              </Button>
            </div>
          )}
        </div>

        {isEditingProfile && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              value={profileForm.name}
              onChange={(event) => handleProfileFieldChange("name", event.target.value)}
              placeholder="이름"
            />
            <Input
              value={profileForm.displayName ?? ""}
              onChange={(event) => handleProfileFieldChange("displayName", event.target.value)}
              placeholder="표시 이름"
            />
            <Input
              value={profileForm.avatarUrl ?? ""}
              onChange={(event) => handleProfileFieldChange("avatarUrl", event.target.value)}
              placeholder="아바타 URL"
            />
            <Input
              value={profileForm.websiteUrl ?? ""}
              onChange={(event) => handleProfileFieldChange("websiteUrl", event.target.value)}
              placeholder="웹사이트 URL"
            />
            <Input
              value={profileForm.location ?? ""}
              onChange={(event) => handleProfileFieldChange("location", event.target.value)}
              placeholder="위치"
            />
            <div className="sm:col-span-2">
              <textarea
                value={profileForm.bio ?? ""}
                onChange={(event) => handleProfileFieldChange("bio", event.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="소개"
              />
            </div>
          </div>
        )}
      </SurfaceCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="게시글" value={summary.stats.postCount} tone="info" />
        <StatCard label="댓글" value={summary.stats.commentCount} tone="success" />
        <StatCard label="좋아요한 게시글" value={summary.stats.likedPostCount} tone="warning" />
      </div>

      <SurfaceCard className="space-y-4 rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            활동 내역
          </h2>
          <SegmentedControl<ActiveTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "posts", label: "내 게시글" },
              { value: "comments", label: "내 댓글" },
            ]}
            className="w-[220px]"
          />
        </div>

        {activeTab === "posts" ? (
          <div className="space-y-2">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                작성한 게시글이 없습니다.
              </div>
            ) : (
              posts.map((post) => {
                const previewText = toPlainText(post.content);

                return (
                  <Link
                    key={post.id}
                    to={`/posts/${post.id}`}
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                  >
                    <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {post.title}
                    </p>
                    {previewText && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {previewText}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>{formatDate(post.createdAt)}</span>
                      {typeof post.likeCount === "number" && <span>좋아요 {post.likeCount}</span>}
                      {typeof post.commentCount === "number" && <span>댓글 {post.commentCount}</span>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {comments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                작성한 댓글이 없습니다.
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  {comment.postTitle && (
                    <p className="line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {comment.postTitle}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {comment.content || "(내용 없음)"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span>{formatDate(comment.createdAt)}</span>
                    {typeof comment.likeCount === "number" && <span>좋아요 {comment.likeCount}</span>}
                    {typeof comment.dislikeCount === "number" && <span>싫어요 {comment.dislikeCount}</span>}
                    {comment.myReaction && comment.myReaction !== "NONE" && (
                      <span className="inline-flex items-center rounded-md bg-blue-600/10 px-1.5 py-0.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                        내 반응 {comment.myReaction}
                      </span>
                    )}
                    {typeof comment.postId === "number" && (
                      <Link
                        to={`/posts/${comment.postId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <UserRound className="h-3 w-3" />
                        원문 보기
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
