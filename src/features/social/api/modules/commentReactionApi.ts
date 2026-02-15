import { API_BASE_URL, api } from "@/shared/lib/api";
import type {
  CommentReactionStatus,
  CommentReactionType,
} from "../../types";

const BASE = API_BASE_URL;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeReactionType(value: unknown): CommentReactionType {
  if (typeof value !== "string") return "NONE";
  const normalized = value.trim().toUpperCase();
  if (normalized === "LIKE") return "LIKE";
  if (normalized === "DISLIKE") return "DISLIKE";
  return "NONE";
}

function normalizeCommentReactionStatus(
  raw: unknown,
  fallback: Pick<CommentReactionStatus, "commentId"> &
    Partial<CommentReactionStatus>,
): CommentReactionStatus {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const commentId = toNumber(obj.commentId) ?? fallback.commentId;
  const likeCount = Math.max(
    0,
    Math.floor(toNumber(obj.likeCount) ?? fallback.likeCount ?? 0),
  );
  const dislikeCount = Math.max(
    0,
    Math.floor(toNumber(obj.dislikeCount) ?? fallback.dislikeCount ?? 0),
  );
  const myReaction =
    obj.myReaction === undefined || obj.myReaction === null
      ? fallback.myReaction ?? "NONE"
      : normalizeReactionType(obj.myReaction);

  return {
    commentId,
    myReaction,
    likeCount,
    dislikeCount,
  };
}

export async function getMyCommentReactionStatus(
  commentId: number,
): Promise<CommentReactionStatus> {
  const data = await api<unknown>(`${BASE}/comments/${commentId}/reaction/me`);
  return normalizeCommentReactionStatus(data, {
    commentId,
    myReaction: "NONE",
    likeCount: 0,
    dislikeCount: 0,
  });
}

export async function updateCommentReaction(
  commentId: number,
  reactionType: CommentReactionType,
): Promise<CommentReactionStatus> {
  const data = await api<unknown>(`${BASE}/comments/${commentId}/reaction`, {
    method: "PUT",
    data: { reactionType },
  });
  return normalizeCommentReactionStatus(data, {
    commentId,
    myReaction: reactionType,
  });
}
