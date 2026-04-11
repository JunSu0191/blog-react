import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken, getUserId, getUserIdFromToken } from "@/shared/lib/auth";
import { showBrowserNotification, shouldUseBrowserNotification } from "@/shared/lib/browserNotifications";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  connect,
  subscribeConversationUnreadCounts,
  subscribeSocketConnected,
  subscribeUserEvents,
} from "@/shared/socket/stompClient";
import {
  CHAT_SOCKET_EVENT_TYPE,
  CHAT_THREAD_TYPE,
  FRIEND_REQUEST_DIRECTION,
} from "../chat.enums";
import { applyIncomingMessageToThread } from "../chatPolicies";
import {
  toChatUserEvent,
  toConversationUnreadCountEvent,
  toThreadFromEventPayload,
  type ChatConversation,
} from "../api";
import {
  buildFriendRequestNotificationFromEvent,
  buildFriendRequestNotificationSignature,
} from "../userEventNotifications";
import {
  chatConversationsQueryKey,
  chatFriendRequestsQueryKey,
  chatFriendsQueryKey,
  chatInvitesQueryKey,
  chatThreadsQueryKey,
  chatTotalUnreadQueryKey,
  getConversationUnreadMessageCount,
  getTotalUnreadMessageCount,
  normalizeUnreadMessageCount,
  useConversations,
} from "../queries";
import { chatUiStoreActions } from "../store/chatUiStore";
import { notificationSummaryQueryKey } from "@/features/notifications";
import type { NotificationItem, NotificationPage, NotificationSummary } from "@/features/notifications";

let temporaryNotificationSequence = 0;
const FRIEND_REQUEST_DEDUPE_TTL_MS = 10_000;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getThreadIdFromEventPayload(payload: Record<string, unknown>) {
  return (
    toFiniteNumber(payload.threadId) ??
    toFiniteNumber(payload.conversationId) ??
    toFiniteNumber(payload.chatThreadId) ??
    toFiniteNumber(payload.roomId)
  );
}

function getMessageContentFromEventPayload(payload: Record<string, unknown>) {
  const message =
    payload.message && typeof payload.message === "object"
      ? (payload.message as Record<string, unknown>)
      : undefined;

  return (
    toNonEmptyString(payload.content) ||
    toNonEmptyString(payload.body) ||
    toNonEmptyString(payload.lastMessage) ||
    toNonEmptyString(message?.content) ||
    toNonEmptyString(message?.body) ||
    toNonEmptyString(message?.message)
  );
}

function getMessageCreatedAtFromEventPayload(payload: Record<string, unknown>) {
  const message =
    payload.message && typeof payload.message === "object"
      ? (payload.message as Record<string, unknown>)
      : undefined;

  return (
    toNonEmptyString(payload.createdAt) ||
    toNonEmptyString(payload.updatedAt) ||
    toNonEmptyString(message?.createdAt) ||
    toNonEmptyString(message?.sentAt)
  );
}

function setThreadCollection(
  conversations: ChatConversation[] | undefined,
  updater: (conversation: ChatConversation) => ChatConversation,
): ChatConversation[] {
  if (!Array.isArray(conversations)) return [];
  return conversations.map(updater);
}

function createTemporaryNotificationId() {
  temporaryNotificationSequence = (temporaryNotificationSequence + 1) % 1000;
  return Date.now() * 1000 + temporaryNotificationSequence;
}

function rememberSignature(
  cache: Map<string, number>,
  signature: string,
  now = Date.now(),
) {
  cache.set(signature, now + FRIEND_REQUEST_DEDUPE_TTL_MS);
}

function hasFreshSignature(
  cache: Map<string, number>,
  signature: string,
  now = Date.now(),
) {
  cache.forEach((expiresAt, key) => {
    if (expiresAt <= now) cache.delete(key);
  });

  const expiresAt = cache.get(signature);
  return typeof expiresAt === "number" && expiresAt > now;
}

function prependNotification(
  prev: { pages?: NotificationPage[]; pageParams?: unknown[] } | null | undefined,
  item: NotificationItem,
) {
  if (!prev || !Array.isArray(prev.pages) || prev.pages.length === 0) {
    return {
      pageParams: [undefined],
      pages: [{ items: [item], hasMore: false, nextCursorId: undefined }],
    };
  }

  const alreadyExists = prev.pages.some((page) => page.items.some((entry) => entry.id === item.id));
  if (alreadyExists) return prev;

  const firstPage = prev.pages[0];
  return {
    ...prev,
    pages: [
      {
        ...firstPage,
        items: [item, ...firstPage.items],
      },
      ...prev.pages.slice(1),
    ],
  };
}

export default function ChatUnreadRealtimeBridge() {
  const { token, user } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const recentFriendEventSignaturesRef = useRef<Map<string, number>>(new Map());
  const effectiveToken = token ?? getToken();
  const currentUserId = useMemo(() => {
    if (typeof user?.id === "number") return user.id;
    return getUserId() ?? getUserIdFromToken(effectiveToken) ?? undefined;
  }, [effectiveToken, user?.id]);
  const isEnabled = Boolean(effectiveToken && typeof currentUserId === "number");
  const { refetch } = useConversations(currentUserId, { enabled: isEnabled });

  const activeConversationId = useMemo(() => {
    if (location.pathname !== "/chat") return undefined;
    const conversationIdRaw = new URLSearchParams(location.search).get(
      "conversationId",
    );
    if (!conversationIdRaw) return undefined;
    const parsed = Number(conversationIdRaw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [location.pathname, location.search]);

  const syncMergedUnread = useMemo(
    () =>
      (userId: number) => {
        const direct =
          queryClient.getQueryData<ChatConversation[]>(
            chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, userId),
          ) || [];
        const group =
          queryClient.getQueryData<ChatConversation[]>(
            chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, userId),
          ) || [];

        const merged = [...direct, ...group].sort((a, b) => {
          const aTs = a.updatedAt ? Date.parse(a.updatedAt) : 0;
          const bTs = b.updatedAt ? Date.parse(b.updatedAt) : 0;
          if (aTs !== bTs) return bTs - aTs;
          return b.id - a.id;
        });

        queryClient.setQueryData(chatConversationsQueryKey(userId), merged);
        queryClient.setQueryData(
          chatTotalUnreadQueryKey(userId),
          getTotalUnreadMessageCount(merged),
        );
      },
    [queryClient],
  );

  useEffect(() => {
    if (typeof currentUserId !== "number") return;
    if (typeof activeConversationId !== "number") return;

    const updateThreadUnread = (conversation: ChatConversation) => {
      if (conversation.id !== activeConversationId) return conversation;
      const unreadCount = getConversationUnreadMessageCount(conversation);
      if (unreadCount === 0) return conversation;
      return {
        ...conversation,
        unreadMessageCount: 0,
        unreadCount: 0,
      };
    };

    queryClient.setQueryData<ChatConversation[]>(
      chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, currentUserId),
      (prev) => setThreadCollection(prev, updateThreadUnread),
    );

    queryClient.setQueryData<ChatConversation[]>(
      chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, currentUserId),
      (prev) => setThreadCollection(prev, updateThreadUnread),
    );

    syncMergedUnread(currentUserId);
  }, [activeConversationId, currentUserId, queryClient, syncMergedUnread]);

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
        const isActiveConversationEvent =
          activeConversationId === event.conversationId;
        const nextUnreadCountForConversation = isActiveConversationEvent
          ? 0
          : nextUnreadMessageCount;

        const updateConversation = (conversation: ChatConversation) => {
          if (conversation.id !== event.conversationId) return conversation;

          const currentUnreadCount = getConversationUnreadMessageCount(conversation);
          if (currentUnreadCount === nextUnreadCountForConversation) {
            return conversation;
          }

          return {
            ...conversation,
            unreadMessageCount: nextUnreadCountForConversation,
            unreadCount: nextUnreadCountForConversation,
          };
        };

        queryClient.setQueryData<ChatConversation[]>(
          chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, currentUserId),
          (prev) => setThreadCollection(prev, updateConversation),
        );

        queryClient.setQueryData<ChatConversation[]>(
          chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, currentUserId),
          (prev) => setThreadCollection(prev, updateConversation),
        );

        syncMergedUnread(currentUserId);
      },
    );

    const unsubscribeUserEvents = subscribeUserEvents(currentUserId, (raw) => {
      const event = toChatUserEvent(raw);
      if (!event) return;

      if (event.type === CHAT_SOCKET_EVENT_TYPE.MESSAGE_CREATED) {
        const threadId = getThreadIdFromEventPayload(event.payload);
        if (typeof threadId !== "number") {
          void refetch();
          return;
        }

        const messageContent = getMessageContentFromEventPayload(event.payload);
        const messageCreatedAt =
          getMessageCreatedAtFromEventPayload(event.payload) ||
          new Date().toISOString();
        const isActive = activeConversationId === threadId;

        let hasMatched = false;

        const updateThread = (conversation: ChatConversation) => {
          if (conversation.id !== threadId) return conversation;
          hasMatched = true;

          if (conversation.hidden) {
            chatUiStoreActions.markThreadResurfaced(threadId);
            chatUiStoreActions.markThreadVisible(threadId);
          }

          return applyIncomingMessageToThread(conversation, {
            threadId,
            isActive,
            messageContent: messageContent || conversation.lastMessage,
            createdAt: messageCreatedAt,
          });
        };

        queryClient.setQueryData<ChatConversation[]>(
          chatThreadsQueryKey(CHAT_THREAD_TYPE.DIRECT, currentUserId),
          (prev) => setThreadCollection(prev, updateThread),
        );
        queryClient.setQueryData<ChatConversation[]>(
          chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, currentUserId),
          (prev) => setThreadCollection(prev, updateThread),
        );

        syncMergedUnread(currentUserId);

        if (!hasMatched) {
          void refetch();
        }

        return;
      }

      if (event.type === CHAT_SOCKET_EVENT_TYPE.THREAD_UPDATED) {
        const updatedThread = toThreadFromEventPayload(event.payload);
        if (!updatedThread) {
          void refetch();
          return;
        }

        if (updatedThread.hidden) {
          chatUiStoreActions.markThreadHidden(updatedThread.id);
        } else {
          chatUiStoreActions.markThreadVisible(updatedThread.id);
        }

        const targetKey = chatThreadsQueryKey(updatedThread.type, currentUserId);
        queryClient.setQueryData<ChatConversation[]>(targetKey, (prev) => {
          if (!Array.isArray(prev) || prev.length === 0) {
            return [updatedThread];
          }

          const index = prev.findIndex((conversation) => conversation.id === updatedThread.id);
          if (index < 0) {
            return [updatedThread, ...prev];
          }

          const next = [...prev];
          next[index] = {
            ...next[index],
            ...updatedThread,
          };
          return next;
        });

        syncMergedUnread(currentUserId);
        return;
      }

      if (
        event.type === CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_RECEIVED ||
        event.type === CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_UPDATED
      ) {
        const signature = buildFriendRequestNotificationSignature(
          event.type,
          event.payload,
        );
        if (hasFreshSignature(recentFriendEventSignaturesRef.current, signature)) {
          return;
        }
        rememberSignature(recentFriendEventSignaturesRef.current, signature);
        const temporaryNotification = buildFriendRequestNotificationFromEvent(
          event.type,
          event.payload,
          createTemporaryNotificationId(),
        );

        if (temporaryNotification) {
          showToast(temporaryNotification.body || temporaryNotification.title || "친구 요청 알림", "info");
          queryClient.setQueryData<{ pages?: NotificationPage[]; pageParams?: unknown[] } | null>(
            ["notifications", "list"],
            (prev) => prependNotification(prev, temporaryNotification),
          );
          queryClient.setQueryData<NotificationSummary | undefined>(
            notificationSummaryQueryKey(),
            (prev) => {
              if (!prev) {
                return {
                  totalCount: 1,
                  unreadCount: 1,
                };
              }
              return {
                totalCount: prev.totalCount + 1,
                unreadCount: prev.unreadCount + 1,
              };
            },
          );

          if (shouldUseBrowserNotification()) {
            void showBrowserNotification({
              title: temporaryNotification.title || "친구 요청",
              body: temporaryNotification.body,
              tag: signature,
              linkUrl: temporaryNotification.linkUrl,
            });
          }
        }

        queryClient.invalidateQueries({
          queryKey: chatFriendRequestsQueryKey(
            FRIEND_REQUEST_DIRECTION.RECEIVED,
            currentUserId,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: chatFriendRequestsQueryKey(
            FRIEND_REQUEST_DIRECTION.SENT,
            currentUserId,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: chatFriendsQueryKey(currentUserId),
        });
        return;
      }

      if (
        event.type === CHAT_SOCKET_EVENT_TYPE.GROUP_INVITE_RECEIVED ||
        event.type === CHAT_SOCKET_EVENT_TYPE.GROUP_INVITE_UPDATED
      ) {
        queryClient.invalidateQueries({
          queryKey: chatInvitesQueryKey(currentUserId),
        });
        queryClient.invalidateQueries({
          queryKey: chatThreadsQueryKey(CHAT_THREAD_TYPE.GROUP, currentUserId),
        });
      }
    });

    const unsubscribeConnected = subscribeSocketConnected(({ isReconnect }) => {
      if (!isReconnect) return;
      void refetch();
    });

    return () => {
      unsubscribeUnread();
      unsubscribeUserEvents();
      unsubscribeConnected();
    };
  }, [
    activeConversationId,
    currentUserId,
    isEnabled,
    queryClient,
    refetch,
    showToast,
    syncMergedUnread,
  ]);

  return null;
}
