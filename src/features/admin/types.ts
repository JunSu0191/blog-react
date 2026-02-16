import type { UserRole, UserStatus } from "@/shared/context/auth.types";

export type AdminListSortDirection = "asc" | "desc";

export type AdminListParams = {
  page: number;
  size: number;
  sort: string;
  keyword?: string;
};

export type AdminDeletedFilter = "all" | "normal" | "hidden";

export type AdminListParamsWithDeleted = AdminListParams & {
  deleted?: AdminDeletedFilter;
};

export type AdminPage<T> = {
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

export type AdminDashboardSummary = {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  totalConversations: number;
  totalNotifications: number;
};

export type AdminUserRow = {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
};

export type AdminPostRow = {
  id: number;
  userId?: number;
  username?: string;
  authorName?: string;
  title: string;
  createdAt?: string;
  deletedAt?: string | null;
};

export type AdminCommentRow = {
  id: number;
  postId?: number;
  postTitle?: string;
  userId?: number;
  username?: string;
  authorName?: string;
  content: string;
  createdAt?: string;
  deletedAt?: string | null;
};
