import { api, API_BASE_URL } from "@/shared/lib/api";
import { uploadImageWithTus } from "./tusUpload";

export type AttachFile = {
  id: number;
  filename?: string;
  url?: string;
};

export type Post = {
  id: number;
  userId: number;
  title: string;
  content: string;
  deletedYn?: string;
  createdAt?: string;
  attachFiles?: AttachFile[];
};

export type CreatePostRequest = {
  title: string;
  content: string;
};

export type UpdatePostRequest = {
  title: string;
  content: string;
};

export type PageResponse<T> = {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
};

export type ApiResponse<T> = {
  status: string;
  success: boolean;
  message: string;
  data: T;
};

export type PostsPageRequest = {
  page?: number;
  size?: number;
  keyword?: string;
};

export type PostsCursorRequest = {
  cursorId?: number;
  size?: number;
  keyword?: string;
};

export type CursorPostsPage = {
  items: Post[];
  nextCursorId?: number;
  hasMore: boolean;
  totalElements?: number;
};

const BASE = API_BASE_URL;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeCursorPostsResponse(raw: unknown, size: number): CursorPostsPage {
  if (Array.isArray(raw)) {
    const items = raw as Post[];
    return {
      items,
      hasMore: items.length >= size,
      nextCursorId: items.length > 0 ? items[items.length - 1].id : undefined,
    };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const rawItems =
      (Array.isArray(obj.items) && obj.items) ||
      (Array.isArray(obj.content) && obj.content) ||
      (Array.isArray(obj.posts) && obj.posts) ||
      (Array.isArray(obj.results) && obj.results) ||
      [];

    const items = rawItems as Post[];
    const hasMore =
      typeof obj.hasMore === "boolean"
        ? obj.hasMore
        : typeof obj.last === "boolean"
          ? !obj.last
          : typeof obj.pageNumber === "number" && typeof obj.totalPages === "number"
            ? obj.pageNumber + 1 < obj.totalPages
            : items.length >= size;

    const nextCursorId =
      toFiniteNumber(obj.nextCursorId) ??
      toFiniteNumber(obj.next_cursor_id) ??
      (items.length > 0 ? items[items.length - 1].id : undefined);

    const totalElements =
      toFiniteNumber(obj.totalElements) ??
      toFiniteNumber(obj.total_elements) ??
      toFiniteNumber(obj.totalCount) ??
      toFiniteNumber(obj.total_count);

    return { items, hasMore, nextCursorId, totalElements };
  }

  return { items: [], hasMore: false };
}

export async function getPosts(
  params?: PostsPageRequest,
): Promise<PageResponse<Post>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined)
      searchParams.append("page", params.page.toString());
    if (params?.size !== undefined)
      searchParams.append("size", params.size.toString());
    if (params?.keyword) searchParams.append("keyword", params.keyword);

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE}/posts?${queryString}` : `${BASE}/posts`;

    const response = await api<PageResponse<Post>>(url);

    // API 응답 구조 검증
    if (!response || typeof response !== "object" || !("content" in response)) {
      throw new Error("API 응답이 PageResponse 형식이 아닙니다");
    }

    return response as PageResponse<Post>;
  } catch (error) {
    console.error("API 호출 실패, mock 데이터로 fallback:", error);

    // Mock 데이터로 fallback - 페이지네이션 API가 준비될 때까지
    const mockPosts: Post[] = [
      {
        id: 1,
        userId: 1,
        title: "샘플 게시글 1",
        content:
          "이것은 샘플 게시글입니다. 페이지네이션 API가 준비되는 동안 표시됩니다.",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        userId: 1,
        title: "샘플 게시글 2",
        content: "두 번째 샘플 게시글입니다.",
        createdAt: new Date().toISOString(),
      },
    ];

    return {
      content: mockPosts,
      pageNumber: 0,
      pageSize: 10,
      totalElements: mockPosts.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
      numberOfElements: mockPosts.length,
    };
  }
}

export async function getPostsByCursor(
  params?: PostsCursorRequest,
): Promise<CursorPostsPage> {
  const searchParams = new URLSearchParams();
  const size = params?.size ?? 9;

  if (params?.cursorId !== undefined) {
    searchParams.append("cursorId", params.cursorId.toString());
  }
  searchParams.append("size", size.toString());
  if (params?.keyword) searchParams.append("keyword", params.keyword);

  const queryString = searchParams.toString();
  const url = queryString ? `${BASE}/posts?${queryString}` : `${BASE}/posts`;
  const data = await api<unknown>(url);

  return normalizeCursorPostsResponse(data, size);
}

export async function getPost(id: number): Promise<Post> {
  return api<Post>(`${BASE}/posts/${id}`);
}

export async function createPost(req: CreatePostRequest): Promise<Post> {
  return api<Post>(`${BASE}/posts`, {
    method: "POST",
    data: req,
  });
}

export async function updatePost(
  id: number,
  req: UpdatePostRequest,
): Promise<Post> {
  return api<Post>(`${BASE}/posts/${id}`, {
    method: "PUT",
    data: req,
  });
}

export async function deletePost(id: number): Promise<void> {
  return api<void>(`${BASE}/posts/${id}`, {
    method: "DELETE",
  });
}

export async function getPostsByUser(userId: number): Promise<Post[]> {
  return api<Post[]>(`${BASE}/posts/user/${userId}`);
}

export async function upload(file: File): Promise<string> {
  return uploadImageWithTus(file);
}
