import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  EllipsisVertical,
  EyeOff,
  LogOut,
  SendHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { ActionDialog, Button } from "@/shared/ui";
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

type ChatRoomProps = {
  conversationId: number;
  currentUserId?: number;
  conversationTitle?: string;
  conversationType?: ChatConversation["type"];
  userDisplayNames?: Record<number, string>;
  onBack?: () => void;
  onRequestLeaveGroup?: (threadId: number) => void;
  onRequestHideThread?: (threadId: number) => void;
  onRequestClearMyMessages?: (threadId: number) => void;
  onRequestInviteMembers?: (threadId: number) => void;
  isLeavingGroup?: boolean;
  isHidingThread?: boolean;
  isClearingMyMessages?: boolean;
  isMobileFullscreen?: boolean;
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

  // 서버가 이벤트 래퍼를 보낼 때만 MESSAGE_CREATED 타입을 검증한다.
  // 메시지 객체를 직접 보낼 경우 type(TEXT 등)는 메시지 타입이므로 필터링하면 안 된다.
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

export default function ChatRoom({
  conversationId,
  currentUserId,
  conversationTitle,
  conversationType,
  userDisplayNames,
  onBack,
  onRequestLeaveGroup,
  onRequestHideThread,
  onRequestClearMyMessages,
  onRequestInviteMembers,
  isLeavingGroup = false,
  isHidingThread = false,
  isClearingMyMessages = false,
  isMobileFullscreen = false,
  className,
}: ChatRoomProps) {
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
  const [isMobileActionMenuOpen, setIsMobileActionMenuOpen] = useState(false);
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
  const canHideThread = Boolean(onRequestHideThread);
  const canClearMyMessages = Boolean(onRequestClearMyMessages);
  const canInviteMembers = Boolean(onRequestInviteMembers);
  const canLeaveGroup = Boolean(onRequestLeaveGroup);
  const hasConversationMenu =
    isGroupConversation || canHideThread || canClearMyMessages;

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
      if (typeof local.id === "number" && serverIdSet.has(local.id))
        return false;
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
    setIsMobileActionMenuOpen(false);
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
    if (isMobileFullscreen) return;
    setIsMobileActionMenuOpen(false);
  }, [isMobileFullscreen]);

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
    if (hasNewTailMessage && !isFetchingNextPage && isNearBottom()) {
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    }

    lastMessageKeyRef.current = latestMessageKey;
  }, [isFetchingNextPage, isNearBottom, latestMessageKey, scrollToBottom]);

  useEffect(() => {
    if (!isMobileFullscreen) return;
    if (typeof window === "undefined") return;

    const alignViewportIfNeeded = () => {
      if (!isNearBottom()) return;
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    };

    const handleComposerFocus = () => {
      window.setTimeout(alignViewportIfNeeded, 120);
    };

    const composer = composerRef.current;
    const visualViewport = window.visualViewport;

    composer?.addEventListener("focus", handleComposerFocus);
    visualViewport?.addEventListener("resize", alignViewportIfNeeded);

    return () => {
      composer?.removeEventListener("focus", handleComposerFocus);
      visualViewport?.removeEventListener("resize", alignViewportIfNeeded);
    };
  }, [isMobileFullscreen, isNearBottom, scrollToBottom]);

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
            const timeoutId = pendingTimeoutRef.current.get(
              message.clientMsgId,
            );
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
        if (isNearBottom()) {
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
  }, [conversationId, currentUserId, isNearBottom, queryClient, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const element = listRef.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;
    if (element.scrollTop <= 40) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSend = useCallback(() => {
    // 엔터 이벤트가 중복 발화될 때(IME 조합/브라우저별 이벤트 차이) 1회만 전송되도록 보호
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
      if (isMobileFullscreen) {
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
    isMobileFullscreen,
    scrollToBottom,
  ]);

  const handleSendFromButton = useCallback(() => {
    handleSend();
    if (isMobileFullscreen) {
      window.requestAnimationFrame(() => {
        focusComposer();
      });
    }
  }, [focusComposer, handleSend, isMobileFullscreen]);

  const handleMobileMenuAction = useCallback((action: () => void) => {
    setIsMobileActionMenuOpen(false);
    action();
  }, []);

  const desktopConversationMenu = hasConversationMenu ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="대화방 메뉴"
        >
          <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-52">
        {isGroupConversation && onRequestInviteMembers && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onRequestInviteMembers(conversationId);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            멤버 초대
          </DropdownMenuItem>
        )}
        {onRequestHideThread && (
          <DropdownMenuItem
            disabled={isHidingThread}
            onSelect={(event) => {
              event.preventDefault();
              onRequestHideThread(conversationId);
            }}
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            {isHidingThread ? "숨기는 중..." : "대화 숨기기"}
          </DropdownMenuItem>
        )}
        {isDirectConversation && onRequestClearMyMessages && (
          <DropdownMenuItem
            className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
            disabled={isClearingMyMessages}
            onSelect={(event) => {
              event.preventDefault();
              onRequestClearMyMessages(conversationId);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isClearingMyMessages ? "삭제 중..." : "내 기록 삭제"}
          </DropdownMenuItem>
        )}
        {isGroupConversation && onRequestLeaveGroup && (
          <DropdownMenuItem
            className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
            disabled={isLeavingGroup}
            onSelect={(event) => {
              event.preventDefault();
              onRequestLeaveGroup(conversationId);
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isLeavingGroup ? "나가는 중..." : "그룹 나가기"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const mobileConversationMenu =
    isMobileFullscreen &&
    hasConversationMenu &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            className={[
              "fixed inset-0 z-[220]",
              isMobileActionMenuOpen ? "pointer-events-auto" : "pointer-events-none",
            ].join(" ")}
            aria-hidden={!isMobileActionMenuOpen}
          >
            <button
              type="button"
              className={[
                "absolute inset-0 bg-slate-950/45 transition-opacity duration-200",
                isMobileActionMenuOpen ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => setIsMobileActionMenuOpen(false)}
              aria-label="메뉴 닫기"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="대화방 메뉴"
              className={[
                "absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900",
                isMobileActionMenuOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
              <div className="space-y-2">
                {isGroupConversation && canInviteMembers && (
                  <button
                    type="button"
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestInviteMembers?.(conversationId))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    멤버 초대
                  </button>
                )}
                {canHideThread && (
                  <button
                    type="button"
                    disabled={isHidingThread}
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestHideThread?.(conversationId))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    {isHidingThread ? "숨기는 중..." : "대화 숨기기"}
                  </button>
                )}
                {isDirectConversation && canClearMyMessages && (
                  <button
                    type="button"
                    disabled={isClearingMyMessages}
                    onClick={() =>
                      handleMobileMenuAction(() =>
                        onRequestClearMyMessages?.(conversationId),
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/55"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {isClearingMyMessages ? "삭제 중..." : "내 기록 삭제"}
                  </button>
                )}
                {isGroupConversation && canLeaveGroup && (
                  <button
                    type="button"
                    disabled={isLeavingGroup}
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestLeaveGroup?.(conversationId))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/55"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {isLeavingGroup ? "나가는 중..." : "그룹 나가기"}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobileActionMenuOpen(false)}
                className="mt-3 flex w-full items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={cn(
        "relative isolate flex min-h-[420px] flex-col overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        isMobileFullscreen
          ? "h-full max-h-full min-h-0 rounded-none border-x-0 border-t-0 shadow-none overscroll-none dark:shadow-none"
          : "h-[calc(100dvh-9.5rem)] rounded-3xl shadow-[0_10px_26px_rgba(15,23,42,0.08)] lg:h-[78vh] lg:min-h-[540px] dark:shadow-[0_18px_38px_-24px_rgba(2,6,23,0.92)]",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-slate-200 bg-white px-3 py-3 sm:px-4 dark:border-slate-700 dark:bg-slate-900",
          isMobileFullscreen &&
            "shrink-0 border-x-0 pt-[env(safe-area-inset-top)] shadow-sm",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="대화 목록으로 이동"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
              {(conversationTitle || "이름 없는 대화방").slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {conversationTitle || "이름 없는 대화방"}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {conversationMetaLabel}
              </p>
            </div>
          </div>
          {hasConversationMenu &&
            (isMobileFullscreen ? (
              <button
                type="button"
                onClick={() => setIsMobileActionMenuOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="대화방 메뉴"
              >
                <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              desktopConversationMenu
            ))}
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className={cn(
          "h-0 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-slate-50/70 dark:bg-slate-950/70",
          isMobileFullscreen
            ? "px-2.5 py-2.5"
            : "px-3 py-3 sm:px-4",
        )}
        style={
          isMobileFullscreen
            ? {
                WebkitOverflowScrolling: "touch",
              }
            : undefined
        }
      >
        {isFetchingNextPage && (
          <div className="py-1 text-center text-xs text-slate-500 dark:text-slate-400">
            이전 메시지 로딩 중...
          </div>
        )}
        {isLoading && (
          <div className="py-1 text-center text-xs text-slate-500 dark:text-slate-400">
            메시지 불러오는 중...
          </div>
        )}

        {messages.map((message) => {
          const isMine = currentUserId && message.senderId === currentUserId;
          const senderDisplayName =
            typeof message.senderName === "string" ? message.senderName.trim() : "";
          const senderMappedName =
            typeof message.senderId === "number"
              ? userDisplayNames?.[message.senderId]?.trim() || ""
              : "";
          const senderLabel = isMine
            ? "나"
            : senderDisplayName || senderMappedName || "알 수 없음";

          return (
            <div
              key={message.localId}
              className={[
                "max-w-[92%] rounded-2xl border px-3 py-2 sm:max-w-[78%]",
                isMine
                  ? "ml-auto border-blue-200 bg-blue-50/90 shadow-[0_1px_2px_rgba(37,99,235,0.1)] dark:border-blue-700/60 dark:bg-blue-950/35"
                  : "mr-auto border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
              ].join(" ")}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="line-clamp-1 font-semibold text-slate-500 dark:text-slate-300">
                  {senderLabel}
                </span>
                <span>
                  {message.createdAt
                    ? new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-100">
                {message.content}
              </p>
              {message.status === "sending" && (
                <p className="mt-1 text-[11px] font-semibold text-blue-600">
                  전송 중...
                </p>
              )}
              {message.status === "failed" && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  전송 실패
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
          isMobileFullscreen
            ? "z-20 shrink-0 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
            : "p-3 sm:p-4",
        )}
      >
        <div
          className={cn(
            "rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/70 mb-2",
            isMobileFullscreen ? "p-1.5" : "p-2 sm:p-2.5",
          )}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={composerRef}
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (
                  isMobileFullscreen ||
                  (typeof window !== "undefined" &&
                    window.matchMedia("(pointer: coarse)").matches)
                ) {
                  return;
                }
                if (event.shiftKey) return;
                if (
                  isComposingRef.current ||
                  event.nativeEvent.isComposing ||
                  event.repeat
                ) {
                  return;
                }
                event.preventDefault();
                handleSend();
              }}
              enterKeyHint={isMobileFullscreen ? "enter" : "send"}
              placeholder="메시지를 입력하세요"
              rows={isMobileFullscreen ? 1 : 2}
              className={cn(
                "max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
                isMobileFullscreen
                  ? "min-h-[38px] px-2.5 py-2 text-[16px]"
                  : "min-h-[46px] px-3 py-2.5 text-sm",
              )}
            />
            <Button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleSendFromButton}
              aria-label="메시지 전송"
              className={cn(
                "shrink-0 rounded-xl bg-blue-600 text-white hover:bg-blue-700",
                isMobileFullscreen
                  ? "h-[38px] w-[38px] p-0"
                  : "h-10 w-10 p-0",
              )}
            >
              <SendHorizontal
                className={isMobileFullscreen ? "h-4 w-4" : "h-[18px] w-[18px]"}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </div>

      <ActionDialog
        {...noticeDialog.dialogProps}
      />
      {mobileConversationMenu}
    </div>
  );
}
