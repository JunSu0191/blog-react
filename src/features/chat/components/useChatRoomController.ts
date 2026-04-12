import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useActionDialog from "@/shared/hooks/useActionDialog";
import {
  connect,
  sendChatMessage,
  subscribeChat,
} from "@/shared/socket/stompClient";
import { CHAT_THREAD_TYPE } from "../chat.enums";
import { toChatMessage, type ChatConversation, type ChatMessage } from "../api";
import { useConversationMessages, useMarkConversationRead } from "../queries";

type LocalMessage = ChatMessage & {
  localId: string;
  status: "sending" | "failed" | "sent";
};

export type ChatRoomBaseProps = {
  conversationId: number;
  currentUserId?: number;
  conversationTitle?: string;
  conversationAvatarUrl?: string;
  conversationType?: ChatConversation["type"];
  userDisplayNames?: Record<number, string>;
  userAvatarUrls?: Record<number, string | undefined>;
  onBack?: () => void;
  onRequestLeaveGroup?: (threadId: number) => void;
  onRequestHideThread?: (threadId: number) => void;
  onRequestClearMyMessages?: (threadId: number) => void;
  onRequestInviteMembers?: (threadId: number) => void;
  isLeavingGroup?: boolean;
  isHidingThread?: boolean;
  isClearingMyMessages?: boolean;
  className?: string;
};

function createClientMsgId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function extractMessageFromSocketPayload(
  conversationId: number,
  payload: unknown,
): ChatMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const hasEnvelope =
    (!!root.message && typeof root.message === "object") ||
    (!!root.data && typeof root.data === "object");

  if (hasEnvelope) {
    const eventType = root.type;
    if (eventType && eventType !== "MESSAGE_CREATED") return null;
  }

  const candidate = hasEnvelope
    ? (root.message as Record<string, unknown> | undefined) ||
      (root.data as Record<string, unknown> | undefined) ||
      root
    : root;

  return toChatMessage(conversationId, candidate);
}

export function useChatRoomController(
  {
    conversationId,
    currentUserId,
    conversationType,
  }: Pick<ChatRoomBaseProps, "conversationId" | "currentUserId" | "conversationType">,
  { isMobile }: { isMobile: boolean },
) {
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pendingTimeoutRef = useRef<Map<string, number>>(new Map());
  const isComposingRef = useRef(false);
  const sendTriggerGuardRef = useRef(false);
  const enterScrollPendingRef = useRef(true);
  const lastMessageKeyRef = useRef<string | null>(null);
  const lastMarkedReadRef = useRef<{
    conversationId: number;
    messageId: number;
  } | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationMessages(conversationId, currentUserId);
  const readMutation = useMarkConversationRead(currentUserId);
  const isDirectConversation =
    typeof conversationType === "string" &&
    conversationType.toUpperCase() === CHAT_THREAD_TYPE.DIRECT;
  const isGroupConversation =
    typeof conversationType === "string" &&
    conversationType.toUpperCase() === CHAT_THREAD_TYPE.GROUP;
  const conversationMetaLabel = isGroupConversation
    ? "그룹 대화"
    : isDirectConversation
      ? "1:1 메시지"
      : "대화방";

  const baseMessages = useMemo(() => {
    const pages = data?.pages || [];
    const merged = pages.flatMap((page) => page.messages);
    const byId = new Map<number, ChatMessage>();
    merged.forEach((message) => {
      if (typeof message.id === "number") byId.set(message.id, message);
    });
    return Array.from(byId.values()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }, [data]);

  const messages = useMemo(() => {
    const serverIdSet = new Set(baseMessages.map((message) => message.id));

    const remainingLocals = localMessages.filter((local) => {
      if (local.status === "sending" || local.status === "failed") return true;
      if (typeof local.id === "number" && serverIdSet.has(local.id)) return false;
      return true;
    });

    const merged = [
      ...baseMessages.map((message) => ({
        ...message,
        localId: `server-${message.id ?? message.clientMsgId ?? message.createdAt}`,
        status: "sent" as const,
      })),
      ...remainingLocals,
    ];

    return merged.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }, [baseMessages, localMessages]);

  const latestMessageKey = useMemo(() => {
    const last = messages[messages.length - 1];
    return last?.localId ?? null;
  }, [messages]);

  const isNearBottom = useCallback(() => {
    const listElement = listRef.current;
    if (!listElement) return true;
    const remaining =
      listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight;
    return remaining < 96;
  }, []);

  const shouldStickToBottom = useCallback(() => {
    if (!isMobile) return true;
    return isNearBottom();
  }, [isMobile, isNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior,
    });
  }, []);

  const focusComposer = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.focus({ preventScroll: true });
    const caretPosition = composer.value.length;
    try {
      composer.setSelectionRange(caretPosition, caretPosition);
    } catch {
      // 일부 모바일 브라우저에서는 setSelectionRange 호출이 실패할 수 있다.
    }
  }, []);

  useEffect(() => {
    setLocalMessages([]);
    setComposerValue("");
    enterScrollPendingRef.current = true;
    pendingTimeoutRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId),
    );
    pendingTimeoutRef.current.clear();
  }, [conversationId]);

  useEffect(() => {
    return () => {
      pendingTimeoutRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      pendingTimeoutRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!enterScrollPendingRef.current) return;
    if (isLoading) return;
    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      scrollToBottom("auto");
      raf2 = window.requestAnimationFrame(() => {
        scrollToBottom("auto");
        enterScrollPendingRef.current = false;
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
    };
  }, [conversationId, isLoading, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!latestMessageKey) {
      lastMessageKeyRef.current = null;
      return;
    }

    if (!lastMessageKeyRef.current) {
      lastMessageKeyRef.current = latestMessageKey;
      return;
    }

    const hasNewTailMessage = lastMessageKeyRef.current !== latestMessageKey;
    if (hasNewTailMessage && !isFetchingNextPage && shouldStickToBottom()) {
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    }

    lastMessageKeyRef.current = latestMessageKey;
  }, [isFetchingNextPage, latestMessageKey, scrollToBottom, shouldStickToBottom]);

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;

    const alignViewportIfNeeded = () => {
      window.scrollTo({ top: 0, behavior: "auto" });
      if (!isNearBottom()) return;
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    };

    const handleComposerFocus = () => {
      window.scrollTo({ top: 0, behavior: "auto" });
      window.setTimeout(alignViewportIfNeeded, 120);
    };

    const composer = composerRef.current;
    const visualViewport = window.visualViewport;

    composer?.addEventListener("focus", handleComposerFocus);
    visualViewport?.addEventListener("resize", alignViewportIfNeeded);
    visualViewport?.addEventListener("scroll", alignViewportIfNeeded);

    return () => {
      composer?.removeEventListener("focus", handleComposerFocus);
      visualViewport?.removeEventListener("resize", alignViewportIfNeeded);
      visualViewport?.removeEventListener("scroll", alignViewportIfNeeded);
    };
  }, [isMobile, isNearBottom, scrollToBottom]);

  useEffect(() => {
    const lastReadMessageId = [...baseMessages]
      .reverse()
      .find((message) => typeof message.id === "number")?.id;

    if (!lastReadMessageId) return;
    if (
      lastMarkedReadRef.current?.conversationId === conversationId &&
      lastMarkedReadRef.current?.messageId === lastReadMessageId
    ) {
      return;
    }

    lastMarkedReadRef.current = {
      conversationId,
      messageId: lastReadMessageId,
    };

    readMutation.mutate({
      conversationId,
      lastReadMessageId,
    });
  }, [baseMessages, conversationId, readMutation]);

  useEffect(() => {
    if (typeof currentUserId !== "number") return;

    connect(currentUserId);
    const unsubscribe = subscribeChat(conversationId, (payload) => {
      const message = extractMessageFromSocketPayload(conversationId, payload);
      if (!message) return;

      setLocalMessages((prev) => {
        if (message.clientMsgId) {
          const matchIndex = prev.findIndex(
            (local) => local.clientMsgId === message.clientMsgId,
          );
          if (matchIndex >= 0) {
            const timeoutId = pendingTimeoutRef.current.get(message.clientMsgId);
            if (typeof timeoutId === "number") {
              window.clearTimeout(timeoutId);
              pendingTimeoutRef.current.delete(message.clientMsgId);
            }
            const clone = [...prev];
            clone[matchIndex] = {
              ...clone[matchIndex],
              ...message,
              status: "sent",
              localId: clone[matchIndex].localId,
            };
            return clone;
          }
        }

        return [
          ...prev,
          {
            ...message,
            localId: `live-${message.id ?? message.clientMsgId ?? Date.now()}`,
            status: "sent",
          },
        ];
      });
      window.requestAnimationFrame(() => {
        if (shouldStickToBottom()) {
          scrollToBottom("auto");
        }
      });

      queryClient.invalidateQueries({
        queryKey: ["chat", "messages", conversationId],
      });
      queryClient.setQueriesData<ChatConversation[]>(
        { queryKey: ["chat", "threads"] },
        (prev) => {
          if (!Array.isArray(prev)) return prev;
          let hasChanged = false;
          const next = prev.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            hasChanged = true;
            return {
              ...conversation,
              lastMessage: message.content,
              updatedAt: message.createdAt || conversation.updatedAt,
            };
          });
          return hasChanged ? next : prev;
        },
      );

      queryClient.setQueriesData<ChatConversation[]>(
        { queryKey: ["chat", "conversations"] },
        (prev) => {
          if (!Array.isArray(prev)) return prev;
          let hasChanged = false;
          const next = prev.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            hasChanged = true;
            return {
              ...conversation,
              lastMessage: message.content,
              updatedAt: message.createdAt || conversation.updatedAt,
            };
          });
          return hasChanged ? next : prev;
        },
      );
    });

    return unsubscribe;
  }, [
    conversationId,
    currentUserId,
    queryClient,
    scrollToBottom,
    shouldStickToBottom,
  ]);

  const handleScroll = useCallback(() => {
    const element = listRef.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;
    if (element.scrollTop <= 40) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSend = useCallback(() => {
    if (sendTriggerGuardRef.current) return;
    sendTriggerGuardRef.current = true;
    window.setTimeout(() => {
      sendTriggerGuardRef.current = false;
    }, 0);

    if (typeof currentUserId !== "number") {
      noticeDialog.show("인증 사용자 정보를 확인한 뒤 다시 시도해주세요.");
      return;
    }

    const content = composerValue.trim();
    if (!content) return;

    const clientMsgId = createClientMsgId();
    const now = new Date().toISOString();

    setComposerValue("");
    setLocalMessages((prev) => [
      ...prev,
      {
        localId: `local-${clientMsgId}`,
        conversationId,
        content,
        createdAt: now,
        clientMsgId,
        status: "sending",
        senderId: currentUserId,
      },
    ]);
    window.requestAnimationFrame(() => {
      scrollToBottom("auto");
      if (isMobile) {
        focusComposer();
      }
    });

    const ok = sendChatMessage(
      conversationId,
      {
        clientMsgId,
        client_msg_id: clientMsgId,
        content,
        body: content,
        type: "TEXT",
        messageType: "TEXT",
      },
      currentUserId,
    );

    if (!ok) {
      const timeoutId = pendingTimeoutRef.current.get(clientMsgId);
      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
        pendingTimeoutRef.current.delete(clientMsgId);
      }
      setLocalMessages((prev) =>
        prev.map((item) =>
          item.clientMsgId === clientMsgId
            ? { ...item, status: "failed" }
            : item,
        ),
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLocalMessages((prev) =>
        prev.map((item) =>
          item.clientMsgId === clientMsgId && item.status === "sending"
            ? { ...item, status: "failed" }
            : item,
        ),
      );
      pendingTimeoutRef.current.delete(clientMsgId);
    }, 10000);
    pendingTimeoutRef.current.set(clientMsgId, timeoutId);
  }, [
    composerValue,
    conversationId,
    currentUserId,
    focusComposer,
    isMobile,
    noticeDialog,
    scrollToBottom,
  ]);

  const handleSendFromButton = useCallback(() => {
    handleSend();
    if (isMobile) {
      window.requestAnimationFrame(() => {
        focusComposer();
      });
    }
  }, [focusComposer, handleSend, isMobile]);

  return {
    listRef,
    composerRef,
    isComposingRef,
    composerValue,
    setComposerValue,
    messages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    handleScroll,
    handleSend,
    handleSendFromButton,
    focusComposer,
    scrollToBottom,
    isDirectConversation,
    isGroupConversation,
    conversationMetaLabel,
    noticeDialogProps: noticeDialog.dialogProps,
  };
}
