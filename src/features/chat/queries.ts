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
  markConversationRead,
  type ChatConversation,
  type ChatMessagesPage,
  type ChatUser,
  type CreateConversationRequest,
} from "./api";

export function useConversations(userId?: number) {
  return useQuery<ChatConversation[], ApiError>({
    queryKey: ["chat", "conversations", userId],
    queryFn: () => getConversations(userId),
  });
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
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { conversationId: number; lastReadMessageId?: number }>({
    mutationFn: ({ conversationId, lastReadMessageId }) =>
      markConversationRead(conversationId, lastReadMessageId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}
