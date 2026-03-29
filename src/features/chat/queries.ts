import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  CHAT_THREAD_TYPE,
  FRIEND_REQUEST_DIRECTION,
  GROUP_INVITE_STATUS,
  type ChatThreadType,
  type FriendRequestDirection,
} from "./chat.enums";
import {
  acceptFriendRequest,
  acceptGroupInvite,
  blockUser,
  cancelFriendRequest,
  clearMyThreadMessages,
  createConversation,
  createDirectConversation,
  createFriendRequest,
  createGroupInvites,
  getChatThreads,
  getChatUsers,
  getConversationMessages,
  getFriendRequests,
  getFriends,
  getPendingGroupInvites,
  hideChatThread,
  leaveGroupChat,
  markConversationRead,
  rejectFriendRequest,
  rejectGroupInvite,
  removeFriend,
  type ChatConversation,
  type ChatMessagesPage,
  type ChatUser,
  type CreateConversationRequest,
  type CreateGroupInviteRequest,
  type Friend,
  type FriendRequest,
  type GroupInvite,
  unhideChatThread,
} from "./api";

type CancelFriendRequestContext = {
  previousSentRequests?: FriendRequest[];
};

type LeaveGroupConversationVariables = {
  threadId: number;
  groupId: number;
};

type LeaveGroupConversationContext = {
  previousGroupThreads?: ChatConversation[];
  previousConversations?: ChatConversation[];
  previousTotalUnread?: number;
};

export function chatThreadsQueryKey(type: ChatThreadType, userId?: number) {
  return ["chat", "threads", type, userId] as const;
}

export function chatConversationsQueryKey(userId?: number) {
  return ["chat", "conversations", userId] as const;
}

export function chatTotalUnreadQueryKey(userId?: number) {
  return ["chat", "totalUnreadMessageCount", userId] as const;
}

export function chatFriendsQueryKey(userId?: number) {
  return ["chat", "friends", userId] as const;
}

export function chatFriendRequestsQueryKey(
  direction: FriendRequestDirection,
  userId?: number,
) {
  return ["chat", "friendRequests", direction, userId] as const;
}

export function chatInvitesQueryKey(userId?: number) {
  return ["chat", "groupInvites", GROUP_INVITE_STATUS.PENDING, userId] as const;
}

function toTimestamp(raw?: string) {
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortThreadsByUpdatedAtDesc(conversations: ChatConversation[]) {
  return [...conversations].sort((a, b) => {
    const diff = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
    if (diff !== 0) return diff;
    return b.id - a.id;
  });
}

function mergeThreadCollections(
  direct: ChatConversation[],
  group: ChatConversation[],
) {
  return sortThreadsByUpdatedAtDesc([...direct, ...group]);
}

export function normalizeUnreadMessageCount(raw: unknown): number {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
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

function setDerivedConversationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: number | undefined,
) {
  if (typeof userId !== "number") return;

  const direct =
    queryClient.getQueryData<ChatConversation[]>(
      chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, userId),
    ) || [];
  const group =
    queryClient.getQueryData<ChatConversation[]>(
      chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, userId),
    ) || [];

  const merged = mergeThreadCollections(direct, group);
  queryClient.setQueryData(chatConversationsQueryKey(userId), merged);
  queryClient.setQueryData(
    chatTotalUnreadQueryKey(userId),
    getTotalUnreadMessageCount(merged),
  );
}

function useChatThreads(
  type: ChatThreadType,
  userId?: number,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const query = useQuery<ChatConversation[], ApiError>({
    queryKey: chatThreadsQueryKey(type, userId),
    queryFn: () => getChatThreads(type, userId),
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (typeof userId !== "number") return;
    if (!query.data) return;
    setDerivedConversationCaches(queryClient, userId);
  }, [query.data, queryClient, userId]);

  return query;
}

export function useChatDirectThreads(userId?: number, options?: { enabled?: boolean }) {
  return useChatThreads(CHAT_THREAD_TYPE.DIRECT, userId, options);
}

export function useChatGroupThreads(userId?: number, options?: { enabled?: boolean }) {
  return useChatThreads(CHAT_THREAD_TYPE.GROUP, userId, options);
}

export function useConversations(userId?: number, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const directQuery = useChatDirectThreads(userId, options);
  const groupQuery = useChatGroupThreads(userId, options);

  const data = useMemo(
    () =>
      mergeThreadCollections(directQuery.data || [], groupQuery.data || []),
    [directQuery.data, groupQuery.data],
  );

  useEffect(() => {
    if (typeof userId !== "number") return;
    queryClient.setQueryData(chatConversationsQueryKey(userId), data);
    queryClient.setQueryData(
      chatTotalUnreadQueryKey(userId),
      getTotalUnreadMessageCount(data),
    );
  }, [data, queryClient, userId]);

  const refetch = async () => {
    await Promise.all([directQuery.refetch(), groupQuery.refetch()]);
  };

  return {
    data,
    isLoading: directQuery.isLoading || groupQuery.isLoading,
    isFetching: directQuery.isFetching || groupQuery.isFetching,
    isError: directQuery.isError || groupQuery.isError,
    error: directQuery.error || groupQuery.error || null,
    refetch,
  };
}

export function useFriends(userId?: number) {
  return useQuery<Friend[], ApiError>({
    queryKey: chatFriendsQueryKey(userId),
    queryFn: () => getFriends(userId),
  });
}

export function useFriendRequests(direction: FriendRequestDirection, userId?: number) {
  return useQuery<FriendRequest[], ApiError>({
    queryKey: chatFriendRequestsQueryKey(direction, userId),
    queryFn: () => getFriendRequests(direction, userId),
  });
}

export function useChatUsers(userId?: number) {
  return useQuery<ChatUser[], ApiError>({
    queryKey: ["chat", "users", userId],
    queryFn: () => getChatUsers(userId),
  });
}

function invalidateFriendDomain(queryClient: ReturnType<typeof useQueryClient>, userId?: number) {
  queryClient.invalidateQueries({ queryKey: chatFriendsQueryKey(userId) });
  queryClient.invalidateQueries({
    queryKey: chatFriendRequestsQueryKey(FRIEND_REQUEST_DIRECTION.RECEIVED, userId),
  });
  queryClient.invalidateQueries({
    queryKey: chatFriendRequestsQueryKey(FRIEND_REQUEST_DIRECTION.SENT, userId),
  });
}

function invalidateThreadDomain(queryClient: ReturnType<typeof useQueryClient>, userId?: number) {
  queryClient.invalidateQueries({
    queryKey: chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, userId),
  });
  queryClient.invalidateQueries({
    queryKey: chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, userId),
  });
  queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey(userId) });
}

export function useCreateFriendRequest(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (targetUserId) => createFriendRequest(targetUserId, userId),
    onSuccess: () => {
      invalidateFriendDomain(queryClient, userId);
    },
  });
}

export function useAcceptFriendRequest(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (requestId) => acceptFriendRequest(requestId, userId),
    onSuccess: () => {
      invalidateFriendDomain(queryClient, userId);
    },
  });
}

export function useRejectFriendRequest(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (requestId) => rejectFriendRequest(requestId, userId),
    onSuccess: () => {
      invalidateFriendDomain(queryClient, userId);
    },
  });
}

export function useCancelFriendRequest(userId?: number) {
  const queryClient = useQueryClient();
  const sentRequestsKey = chatFriendRequestsQueryKey(
    FRIEND_REQUEST_DIRECTION.SENT,
    userId,
  );

  return useMutation<void, ApiError, number, CancelFriendRequestContext>({
    mutationFn: (requestId) => cancelFriendRequest(requestId, userId),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: sentRequestsKey });
      const previousSentRequests =
        queryClient.getQueryData<FriendRequest[]>(sentRequestsKey);

      queryClient.setQueryData<FriendRequest[]>(sentRequestsKey, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((request) => request.requestId !== requestId);
      });

      return {
        previousSentRequests,
      };
    },
    onError: (_error, _requestId, context) => {
      if (context?.previousSentRequests) {
        queryClient.setQueryData<FriendRequest[]>(
          sentRequestsKey,
          context.previousSentRequests,
        );
      } else {
        queryClient.invalidateQueries({ queryKey: sentRequestsKey });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sentRequestsKey });
    },
  });
}

export function useRemoveFriend(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (friendUserId) => removeFriend(friendUserId, userId),
    onSuccess: () => {
      invalidateFriendDomain(queryClient, userId);
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useBlockUser(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (targetUserId) => blockUser(targetUserId, userId),
    onSuccess: () => {
      invalidateFriendDomain(queryClient, userId);
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useCreateConversation(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<ChatConversation, ApiError, CreateConversationRequest>({
    mutationFn: (req) => createConversation(req, userId),
    onSuccess: () => {
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useCreateDirectConversation(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<ChatConversation, ApiError, number>({
    mutationFn: (friendUserId) => createDirectConversation(friendUserId, userId),
    onSuccess: () => {
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useHideThread(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (threadId) => hideChatThread(threadId, userId),
    onSuccess: () => {
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useUnhideThread(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (threadId) => unhideChatThread(threadId, userId),
    onSuccess: () => {
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useClearMyThreadMessages(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (threadId) => clearMyThreadMessages(threadId, userId),
    onSuccess: () => {
      invalidateThreadDomain(queryClient, userId);
      queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
    },
  });
}

export function useLeaveConversation(userId?: number) {
  const queryClient = useQueryClient();
  const groupThreadsKey = chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, userId);
  const conversationsKey = chatConversationsQueryKey(userId);
  const totalUnreadKey = chatTotalUnreadQueryKey(userId);

  return useMutation<
    void,
    ApiError,
    LeaveGroupConversationVariables,
    LeaveGroupConversationContext
  >({
    mutationFn: ({ groupId }) => leaveGroupChat(groupId, userId),
    onMutate: async ({ threadId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: groupThreadsKey }),
        queryClient.cancelQueries({ queryKey: conversationsKey }),
        queryClient.cancelQueries({ queryKey: totalUnreadKey }),
      ]);

      const previousGroupThreads =
        queryClient.getQueryData<ChatConversation[]>(groupThreadsKey);
      const previousConversations =
        queryClient.getQueryData<ChatConversation[]>(conversationsKey);
      const previousTotalUnread =
        queryClient.getQueryData<number>(totalUnreadKey);

      queryClient.setQueryData<ChatConversation[]>(groupThreadsKey, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((thread) => thread.id !== threadId);
      });

      queryClient.setQueryData<ChatConversation[]>(conversationsKey, (prev) => {
        if (!Array.isArray(prev)) return prev;
        const next = prev.filter((thread) => thread.id !== threadId);
        queryClient.setQueryData<number>(
          totalUnreadKey,
          getTotalUnreadMessageCount(next),
        );
        return next;
      });

      queryClient.removeQueries({
        queryKey: ["chat", "messages", threadId],
      });

      return {
        previousGroupThreads,
        previousConversations,
        previousTotalUnread,
      };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousGroupThreads) {
        queryClient.setQueryData<ChatConversation[]>(
          groupThreadsKey,
          context.previousGroupThreads,
        );
      }

      if (context?.previousConversations) {
        queryClient.setQueryData<ChatConversation[]>(
          conversationsKey,
          context.previousConversations,
        );
      }

      if (typeof context?.previousTotalUnread === "number") {
        queryClient.setQueryData<number>(totalUnreadKey, context.previousTotalUnread);
      } else {
        queryClient.invalidateQueries({ queryKey: totalUnreadKey });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: groupThreadsKey });
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({ queryKey: totalUnreadKey });
    },
  });
}

export function useLeaveGroupConversation(userId?: number) {
  return useLeaveConversation(userId);
}

export function useCreateGroupInvites(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, CreateGroupInviteRequest>({
    mutationFn: (req) => createGroupInvites(req, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatInvitesQueryKey(userId) });
    },
  });
}

export function usePendingGroupInvites(userId?: number) {
  return useQuery<GroupInvite[], ApiError>({
    queryKey: chatInvitesQueryKey(userId),
    queryFn: () => getPendingGroupInvites(userId),
  });
}

export function useAcceptGroupInvite(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (inviteId) => acceptGroupInvite(inviteId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatInvitesQueryKey(userId) });
      invalidateThreadDomain(queryClient, userId);
    },
  });
}

export function useRejectGroupInvite(userId?: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (inviteId) => rejectGroupInvite(inviteId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatInvitesQueryKey(userId) });
    },
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

export function useMarkConversationRead(userId?: number) {
  return useMutation<void, ApiError, { conversationId: number; lastReadMessageId?: number }>({
    mutationFn: ({ conversationId, lastReadMessageId }) =>
      markConversationRead(conversationId, lastReadMessageId, userId),
  });
}

export function useChatTotalUnreadCount(userId?: number): UseQueryResult<number, never> {
  return useQuery<number, never>({
    queryKey: chatTotalUnreadQueryKey(userId),
    queryFn: async () => 0,
    enabled: false,
    initialData: 0,
  });
}
