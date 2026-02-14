import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
  type NotificationPage,
} from "./api";

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

export function useReadNotification() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: readNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: readAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });
}
