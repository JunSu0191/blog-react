import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  createConversation,
  createDirectConversation,
  getChatUsers,
  getConversationMessages,
  getConversations,
  leaveConversation,
  markConversationRead,
  type ChatConversation,
  type ChatMessagesPage,
  type ChatUser,
  type CreateConversationRequest,
} from "./api";

export function chatConversationsQueryKey(userId?: number) {
  return ["chat", "conversations", userId] as const;
}

export function chatTotalUnreadQueryKey(userId?: number) {
  return ["chat", "totalUnreadMessageCount", userId] as const;
}

export function normalizeUnreadMessageCount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function getConversationUnreadMessageCount(conversation: ChatConversation): number {
  return normalizeUnreadMessageCount(
    conversation.unreadMessageCount ?? conversation.unreadCount ?? 0,
  );
}

export function getTotalUnreadMessageCount(conversations: ChatConversation[]): number {
  return conversations.reduce(
    (sum, conversation) => sum + getConversationUnreadMessageCount(conversation),
    0,
  );
}

export function useConversations(userId?: number, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery<ChatConversation[], ApiError>({
    queryKey: chatConversationsQueryKey(userId),
    queryFn: () => getConversations(userId),
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (typeof userId !== "number") return;
    if (!query.data) return;
    queryClient.setQueryData(
      chatTotalUnreadQueryKey(userId),
      getTotalUnreadMessageCount(query.data),
    );
  }, [query.data, queryClient, userId]);

  return query;
}

export function useChatUsers(userId?: number) {
  return useQuery<ChatUser[], ApiError>({
    queryKey: ["chat", "users", userId],
    queryFn: () => getChatUsers(userId),
  });
}

export function useConversationMessages(conversationId?: number, userId?: number) {
  return useInfiniteQuery<ChatMessagesPage, ApiError>({
    queryKey: ["chat", "messages", conversationId, userId],
    queryFn: ({ pageParam }) =>
      getConversationMessages(
        conversationId as number,
        typeof pageParam === "number" ? pageParam : undefined,
        30,
        userId,
      ),
    enabled: !!conversationId,
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursorMessageId : undefined,
  });
}

export function useCreateConversation(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<ChatConversation, ApiError, CreateConversationRequest>({
    mutationFn: (req) => createConversation(req, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useCreateDirectConversation(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<ChatConversation, ApiError, number>({
    mutationFn: (otherUserId) => createDirectConversation(otherUserId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useMarkConversationRead(userId?: number) {
  return useMutation<void, ApiError, { conversationId: number; lastReadMessageId?: number }>({
    mutationFn: ({ conversationId, lastReadMessageId }) =>
      markConversationRead(conversationId, lastReadMessageId, userId),
  });
}

export function useLeaveConversation(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (conversationId) => leaveConversation(conversationId),
    onSuccess: (_, conversationId) => {
      let updatedConversations: ChatConversation[] | null = null;

      queryClient.setQueryData<ChatConversation[]>(
        chatConversationsQueryKey(userId),
        (prev) => {
          if (!Array.isArray(prev)) return prev;

          const next = prev.filter(
            (conversation) => conversation.id !== conversationId,
          );
          if (next.length === prev.length) return prev;

          updatedConversations = next;
          return next;
        },
      );

      if (updatedConversations) {
        queryClient.setQueryData(
          chatTotalUnreadQueryKey(userId),
          getTotalUnreadMessageCount(updatedConversations),
        );
      }

      queryClient.removeQueries({
        queryKey: ["chat", "messages", conversationId],
      });
    },
  });
}

export function useChatTotalUnreadCount(userId?: number) {
  return useQuery<number>({
    queryKey: chatTotalUnreadQueryKey(userId),
    queryFn: async () => 0,
    enabled: false,
    initialData: 0,
  });
}
