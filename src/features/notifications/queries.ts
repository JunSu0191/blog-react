import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  getNotificationSummary,
  getNotifications,
  readAllNotifications,
  readNotification,
  type NotificationPage,
  type NotificationSummary,
} from "./api";

export function notificationSummaryQueryKey() {
  return ["notifications", "summary"] as const;
}

export function useNotifications(enabled = true) {
  return useInfiniteQuery<NotificationPage, ApiError>({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) =>
      getNotifications(typeof pageParam === "number" ? pageParam : undefined, 30),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursorId : undefined),
    enabled,
  });
}

export function useNotificationSummary(enabled = true) {
  return useQuery<NotificationSummary, ApiError>({
    queryKey: notificationSummaryQueryKey(),
    queryFn: () => getNotificationSummary(),
    enabled,
    staleTime: 60_000,
  });
}

export function useReadNotification() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: readNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      queryClient.invalidateQueries({ queryKey: notificationSummaryQueryKey() });
    },
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: readAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      queryClient.invalidateQueries({ queryKey: notificationSummaryQueryKey() });
    },
  });
}
