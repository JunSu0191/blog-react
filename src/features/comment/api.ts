import { api, API_BASE_URL } from "@/shared/lib/api";

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentCreateRequest {
  postId: number;
  parentId?: number;
  content: string;
}

export interface CommentUpdateRequest {
  content: string;
}

export interface CommentResponse {
  id: number;
  postId: number;
  userId: number;
  name: string;
  username?: string;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedYn: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: "LIKE" | "DISLIKE" | "NONE" | null;
  replies: CommentResponse[];
}

const BASE = API_BASE_URL;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeCommentResponse(raw: unknown): CommentResponse {
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const nested = (raw as { data?: unknown }).data;
    if (nested && typeof nested === "object") {
      return normalizeCommentResponse(nested);
    }
  }
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nestedUser =
    obj.user && typeof obj.user === "object"
      ? (obj.user as Record<string, unknown>)
      : null;
  const rawReaction = typeof obj.myReaction === "string" ? obj.myReaction.toUpperCase() : null;
  const myReaction =
    rawReaction === "LIKE" || rawReaction === "DISLIKE" || rawReaction === "NONE"
      ? rawReaction
      : null;

  return {
    id: toFiniteNumber(obj.id) ?? 0,
    postId: toFiniteNumber(obj.postId) ?? 0,
    userId: toFiniteNumber(obj.userId) ?? 0,
    name:
      typeof obj.name === "string"
        ? obj.name
        : typeof obj.nickname === "string"
          ? obj.nickname
          : typeof obj.username === "string"
            ? obj.username
            : typeof nestedUser?.name === "string"
              ? nestedUser.name
              : typeof nestedUser?.nickname === "string"
                ? nestedUser.nickname
                : typeof nestedUser?.username === "string"
                  ? nestedUser.username
                  : "익명",
    username:
      typeof obj.username === "string"
        ? obj.username
        : typeof obj.userName === "string"
          ? obj.userName
          : typeof nestedUser?.username === "string"
            ? nestedUser.username
            : undefined,
    parentId:
      typeof toFiniteNumber(obj.parentId) === "number"
        ? (toFiniteNumber(obj.parentId) as number)
        : obj.parentId === null
          ? null
          : null,
    content: typeof obj.content === "string" ? obj.content : "",
    createdAt:
      typeof obj.createdAt === "string"
        ? obj.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof obj.updatedAt === "string"
        ? obj.updatedAt
        : typeof obj.createdAt === "string"
          ? obj.createdAt
          : new Date().toISOString(),
    deletedYn: typeof obj.deletedYn === "string" ? obj.deletedYn : "N",
    likeCount:
      typeof obj.likeCount === "number"
        ? Math.max(0, Math.floor(obj.likeCount))
        : 0,
    dislikeCount:
      typeof obj.dislikeCount === "number"
        ? Math.max(0, Math.floor(obj.dislikeCount))
        : 0,
    myReaction,
    replies: Array.isArray(obj.replies)
      ? obj.replies.map((item) => normalizeCommentResponse(item))
      : [],
  };
}

// 댓글 목록 조회
export async function getComments(postId: number): Promise<CommentResponse[]> {
  try {
    const response = await api<unknown>(
      `${BASE}/comments/posts/${postId}`
    );
    if (!Array.isArray(response)) return [];
    return response.map((item) => normalizeCommentResponse(item));
  } catch (error) {
    console.error("댓글 조회 실패:", error);
    return [];
  }
}

// 댓글 생성
export async function createComment(
  req: CommentCreateRequest
): Promise<CommentResponse> {
  try {
    const response = await api<unknown>(`${BASE}/comments`, {
      method: "POST",
      data: req,
    });
    return normalizeCommentResponse(response);
  } catch (error) {
    console.error("댓글 생성 실패:", error);
    throw error;
  }
}

// 댓글 수정
export async function updateComment(
  id: number,
  req: CommentUpdateRequest
): Promise<CommentResponse> {
  try {
    const response = await api<unknown>(`${BASE}/comments/${id}`, {
      method: "PUT",
      data: req,
    });
    return normalizeCommentResponse(response);
  } catch (error) {
    console.error("댓글 수정 실패:", error);
    throw error;
  }
}

// 댓글 삭제
export async function deleteComment(id: number): Promise<void> {
  try {
    await api(`${BASE}/comments/${id}`, { method: "DELETE" });
  } catch (error) {
    console.error("댓글 삭제 실패:", error);
    throw error;
  }
}
