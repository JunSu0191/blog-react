import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken, getUserId, getUserIdFromToken } from "@/shared/lib/auth";
import {
  connect,
  subscribeConversationUnreadCounts,
  subscribeSocketConnected,
} from "@/shared/socket/stompClient";
import {
  toConversationUnreadCountEvent,
  type ChatConversation,
} from "../api";
import {
  chatConversationsQueryKey,
  chatTotalUnreadQueryKey,
  getConversationUnreadMessageCount,
  getTotalUnreadMessageCount,
  normalizeUnreadMessageCount,
  useConversations,
} from "../queries";

export default function ChatUnreadRealtimeBridge() {
  const { token, user } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const effectiveToken = token ?? getToken();
  const currentUserId = useMemo(() => {
    if (typeof user?.id === "number") return user.id;
    return getUserId() ?? getUserIdFromToken(effectiveToken) ?? undefined;
  }, [effectiveToken, user?.id]);
  const isEnabled = Boolean(effectiveToken && typeof currentUserId === "number");
  const { refetch } = useConversations(currentUserId, { enabled: isEnabled });
  const activeConversationId = useMemo(() => {
    if (location.pathname !== "/chat") return undefined;
    const conversationIdRaw = new URLSearchParams(location.search).get("conversationId");
    if (!conversationIdRaw) return undefined;
    const parsed = Number(conversationIdRaw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof currentUserId !== "number") return;
    if (typeof activeConversationId !== "number") return;

    queryClient.setQueryData<ChatConversation[]>(
      chatConversationsQueryKey(currentUserId),
      (prev) => {
        if (!Array.isArray(prev)) return prev;
        let hasChanged = false;
        const next = prev.map((conversation) => {
          if (conversation.id !== activeConversationId) return conversation;
          const unreadCount = getConversationUnreadMessageCount(conversation);
          if (unreadCount === 0) return conversation;
          hasChanged = true;
          return {
            ...conversation,
            unreadMessageCount: 0,
            unreadCount: 0,
          };
        });
        return hasChanged ? next : prev;
      },
    );

    const latest = queryClient.getQueryData<ChatConversation[]>(
      chatConversationsQueryKey(currentUserId),
    );
    if (Array.isArray(latest)) {
      queryClient.setQueryData(
        chatTotalUnreadQueryKey(currentUserId),
        getTotalUnreadMessageCount(latest),
      );
    }
  }, [activeConversationId, currentUserId, queryClient]);

  useEffect(() => {
    if (typeof currentUserId !== "number") return;

    if (!isEnabled) {
      queryClient.setQueryData(chatTotalUnreadQueryKey(currentUserId), 0);
      return;
    }

    connect(currentUserId);

    const unsubscribeUnread = subscribeConversationUnreadCounts(
      currentUserId,
      (payload) => {
        const event = toConversationUnreadCountEvent(payload);
        if (!event) return;

        const nextUnreadMessageCount = normalizeUnreadMessageCount(
          event.unreadMessageCount,
        );
        const rawTotalUnreadMessageCount = normalizeUnreadMessageCount(
          event.totalUnreadMessageCount,
        );
        const isActiveConversationEvent = activeConversationId === event.conversationId;
        const nextUnreadCountForConversation = isActiveConversationEvent
          ? 0
          : nextUnreadMessageCount;
        const nextTotalUnreadMessageCount = isActiveConversationEvent
          ? Math.max(0, rawTotalUnreadMessageCount - nextUnreadMessageCount)
          : rawTotalUnreadMessageCount;

        queryClient.setQueriesData<ChatConversation[]>(
          { queryKey: chatConversationsQueryKey(currentUserId) },
          (prev) => {
            if (!Array.isArray(prev)) return prev;

            let hasMatched = false;
            let hasChanged = false;
            const next = prev.map((conversation) => {
              if (conversation.id !== event.conversationId) return conversation;
              hasMatched = true;

              const currentUnreadCount = getConversationUnreadMessageCount(conversation);
              if (currentUnreadCount === nextUnreadCountForConversation) {
                return conversation;
              }
              hasChanged = true;

              return {
                ...conversation,
                unreadMessageCount: nextUnreadCountForConversation,
                unreadCount: nextUnreadCountForConversation,
              };
            });

            if (!hasMatched || !hasChanged) return prev;
            return next;
          },
        );

        queryClient.setQueryData(
          chatTotalUnreadQueryKey(currentUserId),
          nextTotalUnreadMessageCount,
        );
      },
    );

    const unsubscribeConnected = subscribeSocketConnected(({ isReconnect }) => {
      if (!isReconnect) return;
      void refetch();
    });

    return () => {
      unsubscribeUnread();
      unsubscribeConnected();
    };
  }, [activeConversationId, currentUserId, isEnabled, queryClient, refetch]);

  return null;
}
