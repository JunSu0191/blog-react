import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserRole, UserStatus } from "@/shared/context/auth.types";
import type { ApiError } from "@/shared/lib/api";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  getAdminComments,
  getAdminDashboardSummary,
  getAdminPosts,
  getAdminUsers,
  hideAdminComment,
  hideAdminPost,
  restoreAdminComment,
  restoreAdminPost,
  updateAdminCategory,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "./api";
import type {
  AdminCategoryUpsertRequest,
  AdminListParams,
  AdminListParamsWithDeleted,
} from "./types";

export const adminQueryKeys = {
  dashboardSummary: ["dashboard-summary"] as const,
  dashboardActivity: ["dashboard-activity"] as const,
  moderationStats: ["moderation-stats"] as const,
  users: (params: AdminListParams) => ["users", params] as const,
  posts: (params: AdminListParamsWithDeleted) => ["posts", params] as const,
  comments: (params: AdminListParamsWithDeleted) =>
    ["comments", params] as const,
  recentPosts: ["posts", "recent"] as const,
  recentComments: ["comments", "recent"] as const,
  categories: ["admin", "categories"] as const,
};

export function useAdminDashboardSummary() {
  return useQuery({
    queryKey: adminQueryKeys.dashboardSummary,
    queryFn: getAdminDashboardSummary,
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: adminQueryKeys.categories,
    queryFn: getAdminCategories,
  });
}

export function useAdminDashboardActivity() {
  return useQuery({
    queryKey: adminQueryKeys.dashboardActivity,
    queryFn: async () => {
      const [posts, comments] = await Promise.all([
        getAdminPosts({
          page: 0,
          size: 80,
          sort: "createdAt,desc",
        }),
        getAdminComments({
          page: 0,
          size: 80,
          sort: "createdAt,desc",
        }),
      ]);
      return { posts, comments };
    },
  });
}

export function useAdminModerationStats() {
  return useQuery({
    queryKey: adminQueryKeys.moderationStats,
    queryFn: async () => {
      const [hiddenPosts, normalPosts, hiddenComments, normalComments] =
        await Promise.all([
          getAdminPosts({
            page: 0,
            size: 1,
            sort: "createdAt,desc",
            deleted: "hidden",
          }),
          getAdminPosts({
            page: 0,
            size: 1,
            sort: "createdAt,desc",
            deleted: "normal",
          }),
          getAdminComments({
            page: 0,
            size: 1,
            sort: "createdAt,desc",
            deleted: "hidden",
          }),
          getAdminComments({
            page: 0,
            size: 1,
            sort: "createdAt,desc",
            deleted: "normal",
          }),
        ]);
      return {
        postsHidden: hiddenPosts.totalElements,
        postsNormal: normalPosts.totalElements,
        commentsHidden: hiddenComments.totalElements,
        commentsNormal: normalComments.totalElements,
      };
    },
  });
}

export function useAdminUsers(params: AdminListParams) {
  return useQuery({
    queryKey: adminQueryKeys.users(params),
    queryFn: () => getAdminUsers(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useAdminPosts(params: AdminListParamsWithDeleted) {
  return useQuery({
    queryKey: adminQueryKeys.posts(params),
    queryFn: () => getAdminPosts(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useAdminComments(params: AdminListParamsWithDeleted) {
  return useQuery({
    queryKey: adminQueryKeys.comments(params),
    queryFn: () => getAdminComments(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useAdminRecentPosts() {
  return useQuery({
    queryKey: adminQueryKeys.recentPosts,
    queryFn: () =>
      getAdminPosts({
        page: 0,
        size: 5,
        sort: "createdAt,desc",
      }),
  });
}

export function useAdminRecentComments() {
  return useQuery({
    queryKey: adminQueryKeys.recentComments,
    queryFn: () =>
      getAdminComments({
        page: 0,
        size: 5,
        sort: "createdAt,desc",
      }),
  });
}

export function useUpdateAdminUserRole() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { userId: number; role: UserRole }>({
    mutationFn: ({ userId, role }) => updateAdminUserRole(userId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateAdminUserStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { userId: number; status: UserStatus }>({
    mutationFn: ({ userId, status }) => updateAdminUserStatus(userId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useHideAdminPost() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { postId: number }>({
    mutationFn: ({ postId }) => hideAdminPost(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useRestoreAdminPost() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { postId: number }>({
    mutationFn: ({ postId }) => restoreAdminPost(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useHideAdminComment() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { commentId: number }>({
    mutationFn: ({ commentId }) => hideAdminComment(commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useRestoreAdminComment() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { commentId: number }>({
    mutationFn: ({ commentId }) => restoreAdminComment(commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useBulkHideAdminPosts() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { postIds: number[] }>({
    mutationFn: async ({ postIds }) => {
      await Promise.all(postIds.map((postId) => hideAdminPost(postId)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
  });
}

export function useBulkRestoreAdminPosts() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { postIds: number[] }>({
    mutationFn: async ({ postIds }) => {
      await Promise.all(postIds.map((postId) => restoreAdminPost(postId)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
  });
}

export function useBulkHideAdminComments() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { commentIds: number[] }>({
    mutationFn: async ({ commentIds }) => {
      await Promise.all(commentIds.map((commentId) => hideAdminComment(commentId)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
  });
}

export function useBulkRestoreAdminComments() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { commentIds: number[] }>({
    mutationFn: async ({ commentIds }) => {
      await Promise.all(commentIds.map((commentId) => restoreAdminComment(commentId)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
  });
}

export function useBulkUpdateAdminUserRole() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { userIds: number[]; role: UserRole }>({
    mutationFn: async ({ userIds, role }) => {
      for (const userId of userIds) {
        await updateAdminUserRole(userId, role);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useBulkUpdateAdminUserStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { userIds: number[]; status: UserStatus }>({
    mutationFn: async ({ userIds, status }) => {
      for (const userId of userIds) {
        await updateAdminUserStatus(userId, status);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useCreateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, AdminCategoryUpsertRequest>({
    mutationFn: (request) => createAdminCategory(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.categories });
      await queryClient.invalidateQueries({ queryKey: ["posts", "categories"] });
    },
  });
}

export function useUpdateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    ApiError,
    { categoryId: number; request: AdminCategoryUpsertRequest }
  >({
    mutationFn: ({ categoryId, request }) =>
      updateAdminCategory(categoryId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.categories });
      await queryClient.invalidateQueries({ queryKey: ["posts", "categories"] });
    },
  });
}

export function useDeleteAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { categoryId: number }>({
    mutationFn: ({ categoryId }) => deleteAdminCategory(categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.categories });
      await queryClient.invalidateQueries({ queryKey: ["posts", "categories"] });
    },
  });
}
