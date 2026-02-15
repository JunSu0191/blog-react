import { API_BASE_URL, api } from "@/shared/lib/api";
import type { PostLikeStatus } from "../../types";

const BASE = API_BASE_URL;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function normalizePostLikeStatus(
  raw: unknown,
  fallback: Pick<PostLikeStatus, "postId"> & Partial<PostLikeStatus>,
): PostLikeStatus {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const postId = toNumber(obj.postId) ?? fallback.postId;
  const liked = toBoolean(obj.liked) ?? fallback.liked ?? false;
  const likeCount = Math.max(
    0,
    Math.floor(toNumber(obj.likeCount) ?? fallback.likeCount ?? 0),
  );

  return {
    postId,
    liked,
    likeCount,
  };
}

export async function getMyPostLikeStatus(postId: number): Promise<PostLikeStatus> {
  const data = await api<unknown>(`${BASE}/posts/${postId}/likes/me`);
  return normalizePostLikeStatus(data, { postId, liked: false, likeCount: 0 });
}

export async function likePost(postId: number): Promise<PostLikeStatus> {
  const data = await api<unknown>(`${BASE}/posts/${postId}/likes`, {
    method: "POST",
  });
  return normalizePostLikeStatus(data, { postId, liked: true });
}

export async function unlikePost(postId: number): Promise<PostLikeStatus> {
  const data = await api<unknown>(`${BASE}/posts/${postId}/likes`, {
    method: "DELETE",
  });
  return normalizePostLikeStatus(data, { postId, liked: false });
}
