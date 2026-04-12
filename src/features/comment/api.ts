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
  nickname?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedYn: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: "LIKE" | "DISLIKE" | "NONE" | null;
  replyCount: number;
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

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function pickText(
  ...values: Array<string | null | undefined>
): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
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
  const obj = toRecord(raw) ?? {};
  const nestedUser = toRecord(obj.user);
  const nestedProfile = toRecord(nestedUser?.profile);
  const username = pickText(
    typeof obj.username === "string" ? obj.username : undefined,
    typeof obj.userName === "string" ? obj.userName : undefined,
    typeof nestedUser?.username === "string" ? nestedUser.username : undefined,
  );
  const nickname = pickText(
    typeof obj.nickname === "string" ? obj.nickname : undefined,
    typeof obj.nickName === "string" ? obj.nickName : undefined,
    typeof nestedUser?.nickname === "string" ? nestedUser.nickname : undefined,
    typeof nestedUser?.nickName === "string" ? nestedUser.nickName : undefined,
    typeof nestedProfile?.nickname === "string" ? nestedProfile.nickname : undefined,
    typeof nestedProfile?.nickName === "string" ? nestedProfile.nickName : undefined,
  );
  const displayName = pickText(
    typeof obj.displayName === "string" ? obj.displayName : undefined,
    typeof obj.display_name === "string" ? obj.display_name : undefined,
    typeof nestedUser?.displayName === "string" ? nestedUser.displayName : undefined,
    typeof nestedUser?.display_name === "string"
      ? nestedUser.display_name
      : undefined,
    typeof nestedProfile?.displayName === "string"
      ? nestedProfile.displayName
      : undefined,
    typeof nestedProfile?.display_name === "string"
      ? nestedProfile.display_name
      : undefined,
  );
  const name = pickText(
    typeof obj.name === "string" ? obj.name : undefined,
    typeof nestedUser?.name === "string" ? nestedUser.name : undefined,
    nickname,
    displayName,
    username,
  ) ?? "익명";
  const rawReaction = typeof obj.myReaction === "string" ? obj.myReaction.toUpperCase() : null;
  const myReaction =
    rawReaction === "LIKE" || rawReaction === "DISLIKE" || rawReaction === "NONE"
      ? rawReaction
      : null;

  return {
    id: toFiniteNumber(obj.id) ?? 0,
    postId: toFiniteNumber(obj.postId) ?? 0,
    userId: toFiniteNumber(obj.userId) ?? 0,
    name,
    nickname,
    displayName,
    username,
    avatarUrl: pickText(
      typeof obj.avatarUrl === "string" ? obj.avatarUrl : undefined,
      typeof obj.avatar_url === "string" ? obj.avatar_url : undefined,
      typeof obj.profileImageUrl === "string" ? obj.profileImageUrl : undefined,
      typeof obj.profile_image_url === "string" ? obj.profile_image_url : undefined,
      typeof nestedUser?.avatarUrl === "string" ? nestedUser.avatarUrl : undefined,
      typeof nestedUser?.avatar_url === "string" ? nestedUser.avatar_url : undefined,
      typeof nestedUser?.profileImageUrl === "string"
        ? nestedUser.profileImageUrl
        : undefined,
      typeof nestedUser?.profile_image_url === "string"
        ? nestedUser.profile_image_url
        : undefined,
      typeof nestedProfile?.avatarUrl === "string" ? nestedProfile.avatarUrl : undefined,
      typeof nestedProfile?.avatar_url === "string" ? nestedProfile.avatar_url : undefined,
      typeof nestedProfile?.profileImageUrl === "string"
        ? nestedProfile.profileImageUrl
        : undefined,
      typeof nestedProfile?.profile_image_url === "string"
        ? nestedProfile.profile_image_url
        : undefined,
    ),
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
    replyCount:
      typeof obj.replyCount === "number"
        ? Math.max(0, Math.floor(obj.replyCount))
        : 0,
  };
}

// 루트 댓글 목록 조회
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

// 특정 댓글의 답글 목록 조회
export async function getCommentReplies(commentId: number): Promise<CommentResponse[]> {
  try {
    const response = await api<unknown>(`${BASE}/comments/${commentId}/replies`);
    if (!Array.isArray(response)) return [];
    return response.map((item) => normalizeCommentResponse(item));
  } catch (error) {
    console.error("답글 조회 실패:", error);
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
