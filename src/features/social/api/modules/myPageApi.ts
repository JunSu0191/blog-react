import { API_BASE_URL, api } from "@/shared/lib/api";
import type {
  CommentReactionType,
  MyPageCommentItem,
  MyPagePostItem,
  MyPageProfileUpdateRequest,
  MyPageSummary,
} from "../../types";

const BASE = API_BASE_URL;

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text ?? null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = toNumber(value);
  if (typeof parsed !== "number") return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeReactionType(value: unknown): CommentReactionType | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "LIKE") return "LIKE";
  if (normalized === "DISLIKE") return "DISLIKE";
  if (normalized === "NONE") return "NONE";
  return undefined;
}

function unwrapData(raw: unknown): unknown {
  let current = raw;
  let guard = 0;

  while (guard < 3) {
    const obj = toRecord(current);
    if (!obj || !("data" in obj)) return current;
    const next = obj.data;
    if (typeof next === "undefined") return current;
    current = next;
    guard += 1;
  }

  return current;
}

function pickText(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toText(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(obj[key]);
    if (typeof value === "number") return value;
  }
  return undefined;
}

function pickObject(
  obj: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = toRecord(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function extractArray(raw: unknown): unknown[] {
  const unwrapped = unwrapData(raw);
  if (Array.isArray(unwrapped)) return unwrapped;

  const obj = toRecord(unwrapped);
  if (!obj) return [];

  const arrayKeys = ["content", "items", "results", "posts", "comments", "list"];
  for (const key of arrayKeys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }

  const nestedPage = pickObject(obj, ["page", "paging"]);
  if (nestedPage) {
    for (const key of arrayKeys) {
      if (Array.isArray(nestedPage[key])) return nestedPage[key] as unknown[];
    }
  }

  return [];
}

function normalizeMyPageSummary(raw: unknown): MyPageSummary {
  const obj = toRecord(unwrapData(raw)) ?? {};
  const user = pickObject(obj, ["user", "member", "account"]) ?? {};
  const profile =
    pickObject(obj, ["profile", "userProfile", "profileInfo"]) ??
    pickObject(user, ["profile", "userProfile"]) ??
    {};
  const stats = pickObject(obj, ["stats", "summaryStats", "counts"]) ?? {};
  const username =
    pickText(obj, ["username", "userName", "login"]) ??
    pickText(user, ["username", "userName", "login"]) ??
    "";
  const name =
    pickText(obj, ["name", "fullName", "nickname"]) ??
    pickText(user, ["name", "fullName", "nickname"]) ??
    username;

  return {
    userId:
      pickNumber(obj, ["userId", "id", "memberId"]) ??
      pickNumber(user, ["userId", "id", "memberId"]) ??
      0,
    username,
    name,
    profile: {
      displayName: toNullableText(
        pickText(profile, [
          "displayName",
          "display_name",
          "nickname",
          "nickName",
        ]),
      ),
      bio: toNullableText(
        pickText(profile, ["bio", "introduction", "introduce", "description"]),
      ),
      avatarUrl: toNullableText(
        pickText(profile, [
          "avatarUrl",
          "avatar_url",
          "profileImageUrl",
          "profile_image_url",
          "profileImage",
          "imageUrl",
        ]),
      ),
      websiteUrl: toNullableText(
        pickText(profile, [
          "websiteUrl",
          "website_url",
          "website",
          "blogUrl",
          "homepage",
        ]),
      ),
      location: toNullableText(
        pickText(profile, ["location", "region", "city", "country"]),
      ),
    },
    stats: {
      postCount: toNonNegativeInt(
        pickNumber(stats, ["postCount", "postsCount", "post_count"]),
      ),
      commentCount: toNonNegativeInt(
        pickNumber(stats, ["commentCount", "commentsCount", "comment_count"]),
      ),
      likedPostCount: toNonNegativeInt(
        pickNumber(stats, [
          "likedPostCount",
          "likedPostsCount",
          "liked_post_count",
          "likePostCount",
        ]),
      ),
    },
  };
}

function normalizeMyPagePostItem(raw: unknown): MyPagePostItem | null {
  const obj = toRecord(unwrapData(raw));
  if (!obj) return null;

  const id = pickNumber(obj, ["id", "postId", "post_id"]);
  if (typeof id !== "number") return null;

  return {
    id,
    title:
      pickText(obj, ["title", "postTitle", "post_title"]) ??
      `게시글 #${id}`,
    content: pickText(obj, ["content", "body", "summary", "excerpt"]),
    createdAt: pickText(obj, ["createdAt", "created_at"]),
    likeCount: pickNumber(obj, ["likeCount", "like_count", "likes"]),
    commentCount: pickNumber(obj, [
      "commentCount",
      "comment_count",
      "commentsCount",
      "comments_count",
    ]),
  };
}

function normalizeMyPageCommentItem(raw: unknown): MyPageCommentItem | null {
  const obj = toRecord(unwrapData(raw));
  if (!obj) return null;

  const post = pickObject(obj, ["post", "article", "targetPost"]) ?? {};
  const id = pickNumber(obj, ["id", "commentId", "comment_id"]);
  if (typeof id !== "number") return null;

  return {
    id,
    postId:
      pickNumber(obj, ["postId", "post_id"]) ??
      pickNumber(post, ["id", "postId"]),
    postTitle:
      pickText(obj, ["postTitle", "post_title", "title"]) ??
      pickText(post, ["title", "postTitle"]),
    content: pickText(obj, ["content", "body", "comment", "text"]) ?? "",
    createdAt: pickText(obj, ["createdAt", "created_at"]),
    likeCount: pickNumber(obj, ["likeCount", "like_count", "likes"]),
    dislikeCount: pickNumber(obj, [
      "dislikeCount",
      "dislike_count",
      "dislikes",
    ]),
    myReaction:
      normalizeReactionType(obj.myReaction) ??
      normalizeReactionType(obj.reactionType) ??
      normalizeReactionType(obj.reaction),
  };
}

function hasAnyKey(obj: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => key in obj);
}

export async function getMyPageSummary(): Promise<MyPageSummary> {
  const data = await api<unknown>(`${BASE}/mypage`);
  return normalizeMyPageSummary(data);
}

export async function updateMyPageProfile(
  payload: MyPageProfileUpdateRequest,
): Promise<MyPageSummary | null> {
  const data = await api<unknown>(`${BASE}/mypage/profile`, {
    method: "PUT",
    data: payload,
  });
  const obj = toRecord(unwrapData(data));
  if (!obj) return null;

  if (
    hasAnyKey(obj, ["userId", "username", "name", "profile", "stats"]) ||
    hasAnyKey(obj, ["user", "member", "account"])
  ) {
    return normalizeMyPageSummary(obj);
  }

  return null;
}

export async function getMyPagePosts(): Promise<MyPagePostItem[]> {
  const data = await api<unknown>(`${BASE}/mypage/posts`);
  return extractArray(data)
    .map((item) => normalizeMyPagePostItem(item))
    .filter((item): item is MyPagePostItem => item !== null);
}

export async function getMyPageComments(): Promise<MyPageCommentItem[]> {
  const data = await api<unknown>(`${BASE}/mypage/comments`);
  return extractArray(data)
    .map((item) => normalizeMyPageCommentItem(item))
    .filter((item): item is MyPageCommentItem => item !== null);
}
