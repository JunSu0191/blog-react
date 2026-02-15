import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { unsubscribeChat } from "@/shared/socket/stompClient";
import SurfaceCard from "@/shared/ui/SurfaceCard";
import { useToast } from "@/shared/ui/ToastProvider";
import { ActionDialog, Button, Input } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { useAuthContext } from "@/shared/context/useAuthContext";
import {
  getToken,
  getUserId,
  getUserIdFromToken,
  setUserId,
} from "@/shared/lib/auth";
import ConversationList from "../components/ConversationList";
import ChatRoom from "../components/ChatRoom";
import { resolveConversationDisplayMeta } from "../conversationDisplay";
import {
  useChatUsers,
  useConversations,
  useCreateConversation,
  useCreateDirectConversation,
  useLeaveConversation,
} from "../queries";

type MobileChatTab = "conversations" | "direct";

const MOBILE_BREAKPOINT = 1024;
const MOBILE_CHAT_PANEL_TRANSITION_MS = 240;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

function parseJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function inferUserIdFromUsers(
  users: Array<{ userId: number; username?: string; name?: string }>,
  payload: Record<string, unknown> | null,
): number | undefined {
  if (!payload) return undefined;

  const identityCandidates = [
    payload.username,
    payload.preferred_username,
    payload.login,
    payload.sub,
    payload.email,
    payload.name,
  ]
    .map((value) => normalizeIdentity(value))
    .filter((value): value is string => Boolean(value));

  if (identityCandidates.length === 0) return undefined;

  const uniqueCandidates = new Set(identityCandidates);
  const matched = users.find((chatUser) => {
    const username = normalizeIdentity(chatUser.username);
    const name = normalizeIdentity(chatUser.name);
    return (
      (username && uniqueCandidates.has(username)) ||
      (name && uniqueCandidates.has(name))
    );
  });

  return matched?.userId;
}

function useIsMobileChatLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    setIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return isMobile;
}

export default function ChatPage() {
  const { user } = useAuthContext();
  const { error: showErrorToast } = useToast();
  const currentUserId = user?.id;
  const isMobile = useIsMobileChatLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = getToken();
  const tokenUserId = useMemo(
    () => getUserIdFromToken(token) ?? undefined,
    [token],
  );
  const tokenPayload = useMemo(() => parseJwtPayload(token), [token]);

  const { data: users = [] } = useChatUsers(currentUserId ?? tokenUserId);

  const effectiveCurrentUserId = useMemo(() => {
    if (typeof currentUserId === "number") return currentUserId;
    if (typeof tokenUserId === "number") return tokenUserId;
    return inferUserIdFromUsers(users, tokenPayload);
  }, [currentUserId, tokenPayload, tokenUserId, users]);

  const { data: conversations = [], isLoading } = useConversations(
    effectiveCurrentUserId,
  );
  const createConversationMutation = useCreateConversation(
    effectiveCurrentUserId,
  );
  const createDirectMutation = useCreateDirectConversation(
    effectiveCurrentUserId,
  );
  const leaveConversationMutation = useLeaveConversation(
    effectiveCurrentUserId,
  );

  const [selectedConversationId, setSelectedConversationId] = useState<
    number | undefined
  >();
  const [mobileTab, setMobileTab] = useState<MobileChatTab>("conversations");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const [leaveTargetConversationId, setLeaveTargetConversationId] = useState<
    number | null
  >(null);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [conversationSearchKeyword, setConversationSearchKeyword] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    number[]
  >([]);
  const [mobilePanelConversationId, setMobilePanelConversationId] = useState<
    number | null
  >(null);
  const [isMobilePanelVisible, setIsMobilePanelVisible] = useState(false);
  const [mobileViewportRect, setMobileViewportRect] = useState({
    top: 0,
    height: 0,
  });
  const mobilePanelTimerRef = useRef<number | null>(null);

  const syncConversationSearchParam = (conversationId?: number) => {
    const currentConversationId = searchParams.get("conversationId");
    const nextConversationId =
      typeof conversationId === "number" ? String(conversationId) : null;

    if (
      (currentConversationId === null && nextConversationId === null) ||
      currentConversationId === nextConversationId
    ) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextConversationId) {
      nextSearchParams.set("conversationId", nextConversationId);
    } else {
      nextSearchParams.delete("conversationId");
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const clearMobilePanelTimer = () => {
    if (mobilePanelTimerRef.current === null) return;
    window.clearTimeout(mobilePanelTimerRef.current);
    mobilePanelTimerRef.current = null;
  };

  const openMobilePanel = (conversationId: number) => {
    if (!isMobile) return;
    clearMobilePanelTimer();
    setMobilePanelConversationId(conversationId);
    if (typeof window === "undefined") {
      setIsMobilePanelVisible(true);
      return;
    }
    window.requestAnimationFrame(() => {
      setIsMobilePanelVisible(true);
    });
  };

  const closeMobilePanel = (options?: {
    immediate?: boolean;
    onClosed?: () => void;
  }) => {
    if (!isMobile) {
      options?.onClosed?.();
      return;
    }
    const immediate = Boolean(options?.immediate);
    clearMobilePanelTimer();
    setIsMobilePanelVisible(false);

    if (immediate) {
      setMobilePanelConversationId(null);
      options?.onClosed?.();
      return;
    }

    mobilePanelTimerRef.current = window.setTimeout(() => {
      setMobilePanelConversationId(null);
      mobilePanelTimerRef.current = null;
      options?.onClosed?.();
    }, MOBILE_CHAT_PANEL_TRANSITION_MS);
  };

  useEffect(() => {
    if (typeof effectiveCurrentUserId !== "number") return;
    if (getUserId() === effectiveCurrentUserId) return;
    setUserId(effectiveCurrentUserId);
  }, [effectiveCurrentUserId]);

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConversationId(undefined);
      if (isMobile) {
        closeMobilePanel({ immediate: true });
      }
      syncConversationSearchParam(undefined);
      return;
    }

    if (typeof selectedConversationId === "number") {
      const isSelectedStillValid = conversations.some(
        (item) => item.id === selectedConversationId,
      );
      if (!isSelectedStillValid) {
        setSelectedConversationId(undefined);
        if (isMobile) {
          closeMobilePanel({ immediate: true });
        }
        syncConversationSearchParam(undefined);
      }
      return;
    }

    syncConversationSearchParam(undefined);
  }, [conversations, isMobile, selectedConversationId, searchParams]);

  useEffect(() => {
    if (typeof selectedConversationId === "number") return;
    syncConversationSearchParam(undefined);
  }, [searchParams, selectedConversationId]);

  useEffect(() => {
    if (isMobile) return;
    closeMobilePanel({ immediate: true });
  }, [isMobile]);

  useEffect(() => {
    return () => {
      clearMobilePanelTimer();
    };
  }, []);

  useEffect(() => {
    if (leaveTargetConversationId === null) return;
    if (leaveConversationMutation.isPending) return;
    const exists = conversations.some(
      (conversation) => conversation.id === leaveTargetConversationId,
    );
    if (!exists) {
      setLeaveTargetConversationId(null);
    }
  }, [
    conversations,
    leaveConversationMutation.isPending,
    leaveTargetConversationId,
  ]);

  const selectableUsers = useMemo(
    () =>
      users.filter((chatUser) => chatUser.userId !== effectiveCurrentUserId),
    [effectiveCurrentUserId, users],
  );

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ),
    [conversations, selectedConversationId],
  );
  const mobilePanelConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === mobilePanelConversationId,
      ),
    [conversations, mobilePanelConversationId],
  );

  const userDisplayNames = useMemo(() => {
    return users.reduce<Record<number, string>>((acc, chatUser) => {
      const label = chatUser.name || chatUser.username;
      if (label) acc[chatUser.userId] = label;
      return acc;
    }, {});
  }, [users]);

  const selectedConversationTitle = useMemo(() => {
    if (!selectedConversation) return undefined;
    return resolveConversationDisplayMeta(selectedConversation).title;
  }, [selectedConversation]);

  const mobilePanelConversationTitle = useMemo(() => {
    if (!mobilePanelConversation) return undefined;
    return resolveConversationDisplayMeta(mobilePanelConversation).title;
  }, [mobilePanelConversation]);
  const leavingConversationId = leaveConversationMutation.isPending
    ? leaveConversationMutation.variables
    : undefined;
  const leaveTargetConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === leaveTargetConversationId,
      ),
    [conversations, leaveTargetConversationId],
  );
  const leaveTargetConversationTitle = useMemo(() => {
    if (!leaveTargetConversation) return undefined;
    return resolveConversationDisplayMeta(leaveTargetConversation).title;
  }, [leaveTargetConversation]);
  const leaveDialogContent = useMemo(() => {
    const base = "정말 이 대화방에서 나가시겠어요?";
    if (!leaveTargetConversationTitle) return base;
    return `${base}\n${leaveTargetConversationTitle}`;
  }, [leaveTargetConversationTitle]);

  const filteredUsers = useMemo(() => {
    const keyword = participantSearch.trim().toLowerCase();
    if (!keyword) return selectableUsers;

    return selectableUsers.filter((chatUser) => {
      const name = (chatUser.name || "").toLowerCase();
      const username = (chatUser.username || "").toLowerCase();
      return (
        name.includes(keyword) ||
        username.includes(keyword) ||
        String(chatUser.userId).includes(keyword)
      );
    });
  }, [participantSearch, selectableUsers]);

  const toggleParticipant = (userId: number) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const resetCreateState = () => {
    setNewRoomTitle("");
    setParticipantSearch("");
    setSelectedParticipantIds([]);
    setIsCreateModalOpen(false);
  };

  const handleCreateRoom = async () => {
    if (!effectiveCurrentUserId) return;
    if (selectedParticipantIds.length === 0) {
      noticeDialog.show("초대할 사용자를 1명 이상 선택해주세요.");
      return;
    }

    try {
      const created = await createConversationMutation.mutateAsync({
        type: "GROUP",
        title: newRoomTitle.trim() || undefined,
        participantUserIds: selectedParticipantIds,
      });
      resetCreateState();
      setSelectedConversationId(created.id);
      setMobileTab("conversations");
      syncConversationSearchParam(created.id);
      openMobilePanel(created.id);
    } catch (error) {
      console.error(error);
      noticeDialog.show("대화방 생성에 실패했습니다.");
    }
  };

  const handleCreateDirect = async (otherUserId: number) => {
    try {
      const created = await createDirectMutation.mutateAsync(otherUserId);
      setSelectedConversationId(created.id);
      setMobileTab("conversations");
      syncConversationSearchParam(created.id);
      openMobilePanel(created.id);
    } catch (error) {
      console.error(error);
      noticeDialog.show("1:1 대화방 생성에 실패했습니다.");
    }
  };

  const handleSelectConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setMobileTab("conversations");
    syncConversationSearchParam(conversationId);
    openMobilePanel(conversationId);
  };

  const openLeaveConversationDialog = (conversationId: number) => {
    if (leaveConversationMutation.isPending) return;
    setLeaveTargetConversationId(conversationId);
  };

  const closeLeaveConversationDialog = () => {
    if (leaveConversationMutation.isPending) return;
    setLeaveTargetConversationId(null);
  };

  const onLeaveConversation = async () => {
    if (typeof leaveTargetConversationId !== "number") return;
    if (leaveConversationMutation.isPending) return;

    const targetConversationId = leaveTargetConversationId;

    try {
      await leaveConversationMutation.mutateAsync(targetConversationId);
      unsubscribeChat(targetConversationId);

      const isActiveConversation =
        selectedConversationId === targetConversationId ||
        mobilePanelConversationId === targetConversationId;

      if (isActiveConversation) {
        setMobileTab("conversations");
        setSelectedConversationId(undefined);
        syncConversationSearchParam(undefined);
        if (isMobile) {
          closeMobilePanel({ immediate: true });
        }
      }

      setLeaveTargetConversationId(null);
    } catch (error) {
      console.error(error);
      showErrorToast(
        "대화방 나가기에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  const handleBackToConversationList = () => {
    setMobileTab("conversations");
    if (isMobile) {
      // URL을 먼저 정리해 레이아웃(nav/header) 상태가 즉시 안정적으로 복귀하도록 한다.
      syncConversationSearchParam(undefined);
      closeMobilePanel({
        onClosed: () => {
          setSelectedConversationId(undefined);
        },
      });
      return;
    }
    setSelectedConversationId(undefined);
    syncConversationSearchParam(undefined);
  };

  const mobileTabIndex = mobileTab === "conversations" ? 0 : 1;
  const isMobileConversationOpen =
    isMobile && mobilePanelConversationId !== null;
  const shouldHideMobileBaseLayer =
    isMobileConversationOpen && isMobilePanelVisible;
  const pageContainerClassName = isMobile
    ? "space-y-3"
    : "route-enter space-y-4 sm:space-y-5";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMobileConversationOpen) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverscrollBehavior = body.style.overscrollBehavior;
    const prevHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overscrollBehavior = prevBodyOverscrollBehavior;
      documentElement.style.overscrollBehavior = prevHtmlOverscrollBehavior;
    };
  }, [isMobileConversationOpen]);

  useEffect(() => {
    if (!isMobileConversationOpen || typeof window === "undefined") return;

    const viewport = window.visualViewport;
    const updateViewportRect = () => {
      const nextTop = viewport
        ? Math.max(0, Math.round(viewport.offsetTop))
        : 0;
      const nextHeight = viewport
        ? Math.max(0, Math.round(viewport.height))
        : Math.max(0, window.innerHeight);

      setMobileViewportRect((prev) => {
        if (prev.top === nextTop && prev.height === nextHeight) return prev;
        return { top: nextTop, height: nextHeight };
      });
    };

    updateViewportRect();
    viewport?.addEventListener("resize", updateViewportRect);
    viewport?.addEventListener("scroll", updateViewportRect);
    window.addEventListener("resize", updateViewportRect);
    window.addEventListener("orientationchange", updateViewportRect);

    return () => {
      viewport?.removeEventListener("resize", updateViewportRect);
      viewport?.removeEventListener("scroll", updateViewportRect);
      window.removeEventListener("resize", updateViewportRect);
      window.removeEventListener("orientationchange", updateViewportRect);
      setMobileViewportRect({ top: 0, height: 0 });
    };
  }, [isMobileConversationOpen]);

  const createRoomModal =
    isCreateModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
            <div className="w-full rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    새 그룹 채팅 만들기
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    멤버를 선택해서 바로 초대할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetCreateState}
                  className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  닫기
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  value={newRoomTitle}
                  onChange={(event) => setNewRoomTitle(event.target.value)}
                  placeholder="방 제목 (예: 프로젝트 QA 룸)"
                />
                <Input
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  placeholder="이름 또는 아이디로 검색"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70">
                  {filteredUsers.length === 0 && (
                    <p className="p-2 text-xs text-slate-500 dark:text-slate-400">
                      검색 결과가 없습니다.
                    </p>
                  )}
                  {filteredUsers.map((chatUser) => {
                    const selected = selectedParticipantIds.includes(
                      chatUser.userId,
                    );
                    return (
                      <button
                        key={chatUser.userId}
                        type="button"
                        onClick={() => toggleParticipant(chatUser.userId)}
                        className={[
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                          selected
                            ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-300"
                            : "border-transparent bg-white text-slate-700 hover:border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
                        ].join(" ")}
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {chatUser.name ||
                              chatUser.username ||
                              `User ${chatUser.userId}`}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            @{chatUser.username || chatUser.userId}
                          </p>
                        </div>
                        <span className="text-xs font-bold">
                          {selected ? "선택됨" : "선택"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>선택 멤버 {selectedParticipantIds.length}명</span>
                  <span>생성 후 즉시 대화방으로 이동</span>
                </div>
                <Button
                  type="button"
                  onClick={handleCreateRoom}
                  isLoading={createConversationMutation.isPending}
                  className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  그룹 생성 후 초대하기
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={pageContainerClassName}>
      {isMobile ? (
        <>
          <div
            className={[
              "space-y-3",
              shouldHideMobileBaseLayer
                ? "pointer-events-none select-none invisible"
                : "",
            ].join(" ")}
            aria-hidden={isMobileConversationOpen}
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Messenger
                </p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {mobileTab === "conversations" ? "채팅" : "빠른 1:1"}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {mobileTab === "conversations"
                        ? "카카오톡처럼 대화 목록에서 방을 선택해 시작하세요."
                        : "유저를 선택하면 바로 1:1 대화방이 열립니다."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="h-9 rounded-xl border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    + 그룹
                  </Button>
                </div>
                <div className="relative mt-3 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                  <span
                    className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-xl bg-white shadow-[0_10px_22px_-16px_rgba(15,23,42,0.55)] transition-transform duration-300 dark:bg-slate-900 dark:shadow-[0_14px_24px_-18px_rgba(2,6,23,0.9)]"
                    style={{
                      transform: `translateX(calc(${mobileTabIndex} * (100% + 0.5rem)))`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileTab("conversations")}
                      className={[
                        "relative z-10 h-10 rounded-xl text-xs font-semibold transition-[color,transform] duration-200 ease-out",
                        mobileTab === "conversations"
                          ? "scale-[1.01] text-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:scale-[1.005] hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100",
                      ].join(" ")}
                    >
                      대화 목록
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileTab("direct")}
                      className={[
                        "relative z-10 h-10 rounded-xl text-xs font-semibold transition-[color,transform] duration-200 ease-out",
                        mobileTab === "direct"
                          ? "scale-[1.01] text-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:scale-[1.005] hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100",
                      ].join(" ")}
                    >
                      빠른 1:1
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {mobileTab === "conversations" ? (
              <SurfaceCard
                padded="none"
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
              >
                <div className="border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-700/80">
                  <Input
                    value={conversationSearchKeyword}
                    onChange={(event) =>
                      setConversationSearchKeyword(event.target.value)
                    }
                    placeholder="대화방 검색"
                    className="h-9 rounded-xl border-slate-200 text-xs dark:border-slate-700"
                  />
                </div>
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  onRequestLeaveConversation={openLeaveConversationDialog}
                  leavingConversationId={leavingConversationId}
                  isLoading={isLoading}
                  searchKeyword={conversationSearchKeyword}
                />
              </SurfaceCard>
            ) : (
              <SurfaceCard className="space-y-3 rounded-3xl border border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    대화 가능한 사용자
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {selectableUsers.length}명
                  </span>
                </div>
                <div className="space-y-2">
                  {selectableUsers.length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      대화 가능한 사용자가 없습니다.
                    </p>
                  )}
                  {selectableUsers.map((chatUser) => (
                    <button
                      key={chatUser.userId}
                      type="button"
                      onClick={() => {
                        void handleCreateDirect(chatUser.userId);
                      }}
                      className="touch-manipulation flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 motion-safe:active:translate-y-[1px] motion-safe:active:scale-[0.985] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      <div>
                        <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {chatUser.name ||
                            chatUser.username ||
                            `User ${chatUser.userId}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          @{chatUser.username || chatUser.userId}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        대화 시작
                      </span>
                    </button>
                  ))}
                </div>
              </SurfaceCard>
            )}
          </div>

          {isMobileConversationOpen &&
            typeof mobilePanelConversationId === "number" && (
              <div
                className={[
                  "fixed inset-x-0 top-0 z-[130] overflow-hidden overscroll-none bg-slate-50 dark:bg-slate-950",
                  isMobilePanelVisible
                    ? "pointer-events-auto"
                    : "pointer-events-none",
                ].join(" ")}
                style={{
                  top:
                    mobileViewportRect.top > 0
                      ? `${mobileViewportRect.top}px`
                      : undefined,
                  height:
                    mobileViewportRect.height > 0
                      ? `${mobileViewportRect.height}px`
                      : "100dvh",
                }}
              >
                <div
                  className={[
                    "absolute inset-0 h-full overflow-hidden overscroll-none bg-slate-50 dark:bg-slate-950 transition-[transform,opacity] ease-out",
                    isMobilePanelVisible
                      ? "translate-x-0 opacity-100"
                      : "translate-x-full opacity-90",
                  ].join(" ")}
                style={{
                  transitionDuration: `${MOBILE_CHAT_PANEL_TRANSITION_MS}ms`,
                }}
                >
                <ChatRoom
                  conversationId={mobilePanelConversationId}
                  currentUserId={effectiveCurrentUserId}
                  conversationTitle={
                    mobilePanelConversationTitle || "이름 없는 대화방"
                  }
                  userDisplayNames={userDisplayNames}
                  onBack={handleBackToConversationList}
                    onRequestLeaveConversation={openLeaveConversationDialog}
                    isLeavingConversation={
                      leavingConversationId === mobilePanelConversationId
                    }
                    isMobileFullscreen
                    className="h-full min-h-0"
                  />
                </div>
              </div>
            )}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                  메신저
                </h1>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                  팀 채팅, 1:1 대화, 초대 기반 그룹방을 한 화면에서 관리합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  + 새 그룹 초대
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div
              className={
                selectedConversationId
                  ? "hidden space-y-4 lg:block"
                  : "space-y-4"
              }
            >
              <SurfaceCard className="space-y-3 rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    빠른 1:1 시작
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {selectableUsers.length}명
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectableUsers.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      대화 가능한 사용자가 없습니다.
                    </p>
                  )}
                  {selectableUsers.map((chatUser) => (
                    <button
                      key={chatUser.userId}
                      type="button"
                      onClick={() => {
                        void handleCreateDirect(chatUser.userId);
                      }}
                      className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {chatUser.name ||
                          chatUser.username ||
                          `User ${chatUser.userId}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        @{chatUser.username || chatUser.userId}
                      </p>
                    </button>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard
                padded="none"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
              >
                <div className="border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-700/80">
                  <Input
                    value={conversationSearchKeyword}
                    onChange={(event) =>
                      setConversationSearchKeyword(event.target.value)
                    }
                    placeholder="대화방 검색"
                    className="h-9 rounded-xl border-slate-200 text-xs dark:border-slate-700"
                  />
                </div>
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  onRequestLeaveConversation={openLeaveConversationDialog}
                  leavingConversationId={leavingConversationId}
                  isLoading={isLoading}
                  searchKeyword={conversationSearchKeyword}
                />
              </SurfaceCard>
            </div>

            <div
              className={selectedConversationId ? "block" : "hidden lg:block"}
            >
              {selectedConversationId ? (
                <ChatRoom
                  conversationId={selectedConversationId}
                  currentUserId={effectiveCurrentUserId}
                  conversationTitle={
                    selectedConversationTitle || "이름 없는 대화방"
                  }
                  userDisplayNames={userDisplayNames}
                  onBack={handleBackToConversationList}
                  onRequestLeaveConversation={openLeaveConversationDialog}
                  isLeavingConversation={
                    leavingConversationId === selectedConversationId
                  }
                />
              ) : (
                <SurfaceCard className="flex h-[72vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  왼쪽에서 대화방을 선택하거나 새 그룹을 만들어주세요.
                </SurfaceCard>
              )}
            </div>
          </div>
        </>
      )}

      <ActionDialog
        {...noticeDialog.dialogProps}
      />

      <ActionDialog
        open={leaveTargetConversationId !== null}
        title="대화방 나가기"
        content={leaveDialogContent}
        contentClassName="whitespace-pre-line text-sm text-slate-500 dark:text-slate-400"
        cancelText="취소"
        confirmText={leaveConversationMutation.isPending ? "나가는 중..." : "나가기"}
        confirmDisabled={leaveConversationMutation.isPending}
        cancelDisabled={leaveConversationMutation.isPending}
        preventAutoCloseOnConfirm
        onOpenChange={(open) => {
          if (!open) closeLeaveConversationDialog();
        }}
        onConfirm={() => {
          void onLeaveConversation();
        }}
        confirmClassName="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
        cancelClassName="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        footerClassName="gap-2 sm:justify-end sm:space-x-0"
      />
      {createRoomModal}
    </div>
  );
}
