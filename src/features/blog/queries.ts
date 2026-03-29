import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  fetchBlogProfile,
  fetchMyBlogSettings,
  updateMyBlogSettings,
} from "./api";
import type {
  BlogProfileData,
  BlogProfileQuery,
  BlogThemeSettings,
  BlogThemeSettingsRequest,
} from "./types";

type QueryOptions = {
  enabled?: boolean;
};

type InfiniteBlogProfileQuery = Omit<BlogProfileQuery, "page">;

export function useBlogProfile(
  username: string,
  params?: BlogProfileQuery,
  options?: QueryOptions,
) {
  return useQuery<BlogProfileData, ApiError>({
    queryKey: ["blogs", "profile", username, params],
    queryFn: () => fetchBlogProfile(username, params),
    enabled: (options?.enabled ?? true) && username.trim().length > 0,
  });
}

export function useInfiniteBlogProfile(
  username: string,
  params?: InfiniteBlogProfileQuery,
  options?: QueryOptions,
) {
  const pageSize = params?.size ?? 10;

  return useInfiniteQuery<BlogProfileData, ApiError>({
    queryKey: ["blogs", "profile", "infinite", username, params],
    queryFn: ({ pageParam }) =>
      fetchBlogProfile(username, {
        ...params,
        page: typeof pageParam === "number" ? pageParam : 0,
        size: pageSize,
      }),
    enabled: (options?.enabled ?? true) && username.trim().length > 0,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.posts.last ? undefined : lastPage.posts.pageNumber + 1,
  });
}

export function useMyBlogSettings(options?: QueryOptions) {
  return useQuery<BlogThemeSettings, ApiError>({
    queryKey: ["blogs", "settings", "me"],
    queryFn: () => fetchMyBlogSettings(),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateMyBlogSettings() {
  const queryClient = useQueryClient();

  return useMutation<BlogThemeSettings, ApiError, BlogThemeSettingsRequest>({
    mutationFn: (request) => updateMyBlogSettings(request),
    onSuccess: (data) => {
      queryClient.setQueryData(["blogs", "settings", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["blogs", "profile"] });
    },
  });
}
