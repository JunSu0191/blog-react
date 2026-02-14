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
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedYn: string;
  likeCount: number;
  replies: any[];
}

const BASE = API_BASE_URL;

function normalizeCommentResponse(raw: unknown): CommentResponse {
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const nested = (raw as { data?: unknown }).data;
    if (nested && typeof nested === "object") {
      return nested as CommentResponse;
    }
  }
  return raw as CommentResponse;
}

// 댓글 목록 조회
export async function getComments(postId: number): Promise<CommentResponse[]> {
  try {
    const response = await api<CommentResponse[]>(
      `${BASE}/comments/posts/${postId}`
    );
    return response || [];
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
