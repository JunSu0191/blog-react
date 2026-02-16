import { API_BASE_URL, api } from "@/shared/lib/api";
import type { UserRole, UserStatus } from "@/shared/context/auth.types";
import type {
  AdminCommentRow,
  AdminDashboardSummary,
  AdminDeletedFilter,
  AdminListParams,
  AdminListParamsWithDeleted,
  AdminPage,
  AdminPostRow,
  AdminUserRow,
} from "./types";

const ADMIN_BASE = `${API_BASE_URL}/admin`;
const DEFAULT_PAGE_SIZE = 20;

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function resolveRole(value: unknown): UserRole {
  const normalized = toText(value)?.toUpperCase();
  return normalized === "ADMIN" ? "ADMIN" : "USER";
}

function resolveStatus(value: unknown): UserStatus {
  const normalized = toText(value)?.toUpperCase();
  return normalized === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
}

function resolveDeletedAt(obj: Record<string, unknown>): string | null {
  return (
    toText(obj.deletedAt) ||
    toText(obj.deleted_at) ||
    toText(obj.archivedAt) ||
    toText(obj.archived_at) ||
    (toText(obj.deletedYn)?.toUpperCase() === "Y" ? "__hidden__" : null)
  );
}

function normalizeAdminUser(raw: unknown): AdminUserRow | null {
  const obj = toObject(raw);
  if (!obj) return null;

  const id = toFiniteNumber(obj.id) ?? toFiniteNumber(obj.userId);
  if (typeof id !== "number") return null;

  return {
    id,
    username: toText(obj.username) || `user-${id}`,
    name: toText(obj.name) || toText(obj.displayName) || "-",
    role: resolveRole(obj.role),
    status: resolveStatus(obj.status),
    createdAt: toText(obj.createdAt) || toText(obj.created_at),
  };
}

function normalizeAdminPost(raw: unknown): AdminPostRow | null {
  const obj = toObject(raw);
  if (!obj) return null;

  const id = toFiniteNumber(obj.id) ?? toFiniteNumber(obj.postId);
  if (typeof id !== "number") return null;

  return {
    id,
    userId: toFiniteNumber(obj.userId) ?? toFiniteNumber(obj.authorId),
    username: toText(obj.username) || toText(obj.authorUsername),
    authorName: toText(obj.authorName) || toText(obj.name),
    title: toText(obj.title) || "(제목 없음)",
    createdAt: toText(obj.createdAt) || toText(obj.created_at),
    deletedAt: resolveDeletedAt(obj),
  };
}

function normalizeAdminComment(raw: unknown): AdminCommentRow | null {
  const obj = toObject(raw);
  if (!obj) return null;

  const id = toFiniteNumber(obj.id) ?? toFiniteNumber(obj.commentId);
  if (typeof id !== "number") return null;

  return {
    id,
    postId: toFiniteNumber(obj.postId),
    postTitle: toText(obj.postTitle) || toText(obj.post_title),
    userId: toFiniteNumber(obj.userId) ?? toFiniteNumber(obj.authorId),
    username: toText(obj.username) || toText(obj.authorUsername),
    authorName: toText(obj.authorName) || toText(obj.name),
    content: toText(obj.content) || "(내용 없음)",
    createdAt: toText(obj.createdAt) || toText(obj.created_at),
    deletedAt: resolveDeletedAt(obj),
  };
}

function normalizeAdminPage<T>(
  raw: unknown,
  itemMapper: (item: unknown) => T | null,
): AdminPage<T> {
  const obj = toObject(raw);

  const rawContent =
    (obj && Array.isArray(obj.content) && obj.content) ||
    (obj && Array.isArray(obj.items) && obj.items) ||
    [];

  const content = rawContent
    .map((item) => itemMapper(item))
    .filter((item): item is T => item !== null);

  const pageNumber =
    (obj && (toFiniteNumber(obj.pageNumber) ?? toFiniteNumber(obj.number))) ?? 0;
  const pageSize =
    (obj &&
      (toFiniteNumber(obj.pageSize) ??
        toFiniteNumber(obj.size) ??
        toFiniteNumber(obj.numberOfElements))) ??
    DEFAULT_PAGE_SIZE;
  const totalElements =
    (obj && toFiniteNumber(obj.totalElements)) ?? content.length;
  const totalPages =
    (obj && toFiniteNumber(obj.totalPages)) ??
    Math.max(1, Math.ceil(totalElements / Math.max(1, pageSize)));

  const first = (obj && toBoolean(obj.first)) ?? pageNumber <= 0;
  const last = (obj && toBoolean(obj.last)) ?? pageNumber + 1 >= totalPages;
  const numberOfElements =
    (obj && toFiniteNumber(obj.numberOfElements)) ?? content.length;
  const empty = (obj && toBoolean(obj.empty)) ?? content.length === 0;

  return {
    content,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    first,
    last,
    numberOfElements,
    empty,
  };
}

function buildListQuery(params: AdminListParamsWithDeleted): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("size", String(params.size));
  searchParams.set("sort", params.sort || "createdAt,desc");

  const keyword = params.keyword?.trim();
  if (keyword) {
    searchParams.set("keyword", keyword);
  }

  if (params.deleted && params.deleted !== "all") {
    searchParams.set("deleted", params.deleted === "hidden" ? "true" : "false");
  }

  return searchParams.toString();
}

function normalizeSummary(raw: unknown): AdminDashboardSummary {
  const obj = toObject(raw);
  if (!obj) {
    return {
      totalUsers: 0,
      totalPosts: 0,
      totalComments: 0,
      totalConversations: 0,
      totalNotifications: 0,
    };
  }

  return {
    totalUsers: toFiniteNumber(obj.totalUsers) ?? toFiniteNumber(obj.users) ?? 0,
    totalPosts: toFiniteNumber(obj.totalPosts) ?? toFiniteNumber(obj.posts) ?? 0,
    totalComments: toFiniteNumber(obj.totalComments) ?? toFiniteNumber(obj.comments) ?? 0,
    totalConversations:
      toFiniteNumber(obj.totalConversations) ?? toFiniteNumber(obj.conversations) ?? 0,
    totalNotifications:
      toFiniteNumber(obj.totalNotifications) ?? toFiniteNumber(obj.notifications) ?? 0,
  };
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const data = await api<unknown>(`${ADMIN_BASE}/dashboard/summary`);
  return normalizeSummary(data);
}

export async function getAdminUsers(
  params: AdminListParams,
): Promise<AdminPage<AdminUserRow>> {
  const queryString = buildListQuery(params);
  const data = await api<unknown>(`${ADMIN_BASE}/users?${queryString}`);
  return normalizeAdminPage(data, normalizeAdminUser);
}

export async function updateAdminUserRole(
  userId: number,
  role: UserRole,
): Promise<void> {
  await api<void>(`${ADMIN_BASE}/users/${userId}/role`, {
    method: "PATCH",
    data: { role },
  });
}

export async function updateAdminUserStatus(
  userId: number,
  status: UserStatus,
): Promise<void> {
  await api<void>(`${ADMIN_BASE}/users/${userId}/status`, {
    method: "PATCH",
    data: { status },
  });
}

export async function getAdminPosts(
  params: AdminListParamsWithDeleted,
): Promise<AdminPage<AdminPostRow>> {
  const queryString = buildListQuery(params);
  const data = await api<unknown>(`${ADMIN_BASE}/posts?${queryString}`);
  return normalizeAdminPage(data, normalizeAdminPost);
}

export async function hideAdminPost(postId: number): Promise<void> {
  await api<void>(`${ADMIN_BASE}/posts/${postId}/hide`, {
    method: "PATCH",
  });
}

export async function restoreAdminPost(postId: number): Promise<void> {
  await api<void>(`${ADMIN_BASE}/posts/${postId}/restore`, {
    method: "PATCH",
  });
}

export async function getAdminComments(
  params: AdminListParamsWithDeleted,
): Promise<AdminPage<AdminCommentRow>> {
  const queryString = buildListQuery(params);
  const data = await api<unknown>(`${ADMIN_BASE}/comments?${queryString}`);
  return normalizeAdminPage(data, normalizeAdminComment);
}

export async function hideAdminComment(commentId: number): Promise<void> {
  await api<void>(`${ADMIN_BASE}/comments/${commentId}/hide`, {
    method: "PATCH",
  });
}

export async function restoreAdminComment(commentId: number): Promise<void> {
  await api<void>(`${ADMIN_BASE}/comments/${commentId}/restore`, {
    method: "PATCH",
  });
}

export function normalizeDeletedFilter(
  value?: string | null,
): AdminDeletedFilter {
  if (value === "hidden" || value === "true") return "hidden";
  if (value === "normal" || value === "false") return "normal";
  return "all";
}
