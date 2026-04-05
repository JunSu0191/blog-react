import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { EyeOff, LogOut, Trash2, X } from 'lucide-react';
import { useAuthContext } from "@/shared/context/useAuthContext";
import {
  getToken,
  getUserId,
  getUserIdFromToken,
  setUserId,
} from "@/shared/lib/auth";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import { unsubscribeChat } from "@/shared/socket/stompClient";
import SurfaceCard from "@/shared/ui/SurfaceCard";
import { ActionDialog, Button, Input } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  CHAT_MEMBERSHIP_STATE,
  CHAT_THREAD_TYPE,
  FRIEND_RELATION_STATUS,
  FRIEND_REQUEST_DIRECTION,
  type FriendRelationStatus,
} from "../chat.enums";
import ConversationList from "../components/ConversationList";
import ChatRoom from "../components/ChatRoom";
import { canStartDirectChat } from "../chatPolicies";
import {
  useAcceptFriendRequest,
  useAcceptGroupInvite,
  useBlockUser,
  useCancelFriendRequest,
  useChatDirectThreads,
  useChatGroupThreads,
  useChatUsers,
  useClearMyThreadMessages,
  useCreateConversation,
  useCreateDirectConversation,
  useCreateFriendRequest,
  useCreateGroupInvites,
  useFriendRequests,
  useFriends,
  useHideThread,
  useLeaveGroupConversation,
  usePendingGroupInvites,
  useRejectFriendRequest,
  useRejectGroupInvite,
  useRemoveFriend,
  useUnhideThread,
} from "../queries";
import {
  CHAT_SIDEBAR_SECTION,
  chatUiStoreActions,
  useChatUiStore,
  type ChatSidebarSection,
} from "../store/chatUiStore";

type ChatUserLike = {
  userId: number;
  username?: string;
  name?: string;
  nickname?: string;
};

type InlineActionErrors = Record<string, string>;
type MobileSheetKind = "friend-add" | "create-group" | "group-invite";

const MOBILE_BREAKPOINT = 1024;
const MOBILE_CHAT_LIST_VIEWPORT_OFFSET = "calc(10.5rem + env(safe-area-inset-bottom))";
const MOBILE_CHAT_LIST_BOTTOM_PADDING = "calc(5.5rem + env(safe-area-inset-bottom))";
const MOBILE_SHEET_EXIT_DURATION_MS = 220;

const SIDEBAR_SECTIONS: Array<{
  key: ChatSidebarSection;
  label: string;
}> = [
  { key: CHAT_SIDEBAR_SECTION.FRIENDS, label: "친구" },
  { key: CHAT_SIDEBAR_SECTION.DIRECT, label: "개인채팅" },
  { key: CHAT_SIDEBAR_SECTION.GROUP, label: "그룹채팅" },
  { key: CHAT_SIDEBAR_SECTION.INVITES, label: "초대함" },
];

const FRIEND_STATUS_LABEL: Record<FriendRelationStatus, string> = {
  [FRIEND_RELATION_STATUS.PENDING]: "대기",
  [FRIEND_RELATION_STATUS.ACCEPTED]: "수락됨",
  [FRIEND_RELATION_STATUS.REJECTED]: "거절됨",
  [FRIEND_RELATION_STATUS.BLOCKED]: "차단됨",
  [FRIEND_RELATION_STATUS.CANCELED]: "취소됨",
};

const FRIEND_STATUS_STYLE: Record<FriendRelationStatus, string> = {
  [FRIEND_RELATION_STATUS.PENDING]:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  [FRIEND_RELATION_STATUS.ACCEPTED]:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  [FRIEND_RELATION_STATUS.REJECTED]:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  [FRIEND_RELATION_STATUS.BLOCKED]:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  [FRIEND_RELATION_STATUS.CANCELED]:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function useIsMobileChatLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isMobile;
}

function useMobileVisualViewportHeight(active: boolean) {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 0 : Math.round(window.innerHeight),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!active) return;

    const measure = () =>
      Math.max(
        1,
        Math.round(window.visualViewport?.height ?? window.innerHeight),
      );
    const baseHeightRef = { current: measure() };
    const visualViewport = window.visualViewport;
    const updateViewport = () => {
      const measuredHeight = measure();
      const keyboardLikelyOpen = baseHeightRef.current - measuredHeight > 120;
      // 키보드가 열리면 마지막 "키보드 닫힘" 높이로 고정한다.
      const normalizedHeight = keyboardLikelyOpen
        ? baseHeightRef.current
        : measuredHeight;
      if (!keyboardLikelyOpen) baseHeightRef.current = measuredHeight;

      setViewportHeight((prev) =>
        prev === normalizedHeight ? prev : normalizedHeight,
      );
    };

    const handleOrientationChange = () => {
      const measuredHeight = measure();
      baseHeightRef.current = measuredHeight;
      setViewportHeight((prev) =>
        prev === measuredHeight ? prev : measuredHeight,
      );
      window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    visualViewport?.addEventListener("resize", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [active]);

  return viewportHeight;
}

function toActionErrorMessage(error: unknown, fallback: string) {
  const parsed = parseErrorMessage(error, fallback);
  const lower = parsed.toLowerCase();

  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("cors")
  ) {
    return "네트워크 또는 CORS 문제로 요청에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (lower.includes("500") || lower.includes("502") || lower.includes("503")) {
    return "서버 오류(5xx)로 요청에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  return parsed;
}

function userLabel(user: ChatUserLike) {
  const nickname = typeof user.nickname === "string" ? user.nickname.trim() : "";
  if (nickname) return nickname;

  const name = typeof user.name === "string" ? user.name.trim() : "";
  if (name) return name;

  return "알 수 없음";
}

function userSubLabel(..._args: unknown[]) {
  return undefined;
}

function userSearchableText(user: ChatUserLike) {
  return [user.nickname, user.name, user.username, String(user.userId)]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function extractThreadTitle(thread?: {
  displayTitle?: string;
  title?: string | null;
}) {
  if (!thread) return "";
  const displayTitle =
    typeof thread.displayTitle === "string" ? thread.displayTitle.trim() : "";
  if (displayTitle) return displayTitle;
  const title = typeof thread.title === "string" ? thread.title.trim() : "";
  return title || "이름 없는 대화방";
}

export default function ChatPage() {
  const { user } = useAuthContext();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobileChatLayout();

  const currentUserId = useMemo(() => {
    if (typeof user?.id === "number") return user.id;
    const token = getToken();
    return getUserId() ?? getUserIdFromToken(token) ?? undefined;
  }, [user?.id]);

  const activeSection = useChatUiStore((state) => state.activeSection);
  const activeThreadId = useChatUiStore((state) => state.activeThreadId);
  const hiddenThreadIds = useChatUiStore((state) => state.hiddenThreadIds);
  const resurfacedThreadIds = useChatUiStore((state) => state.resurfacedThreadIds);

  const [directSearchKeyword, setDirectSearchKeyword] = useState("");
  const [groupSearchKeyword, setGroupSearchKeyword] = useState("");

  const [isFriendAddModalOpen, setIsFriendAddModalOpen] = useState(false);
  const [friendSearchKeyword, setFriendSearchKeyword] = useState("");

  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [createGroupTitle, setCreateGroupTitle] = useState("");
  const [createGroupSearchKeyword, setCreateGroupSearchKeyword] = useState("");
  const [createGroupParticipantIds, setCreateGroupParticipantIds] = useState<number[]>([]);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [mobileSheetDragY, setMobileSheetDragY] = useState(0);
  const [closingMobileSheet, setClosingMobileSheet] = useState<MobileSheetKind | null>(null);

  const [inviteTargetThreadId, setInviteTargetThreadId] = useState<number | null>(null);
  const [inviteSearchKeyword, setInviteSearchKeyword] = useState("");
  const [inviteTargetUserIds, setInviteTargetUserIds] = useState<number[]>([]);

  const [hideTargetThreadId, setHideTargetThreadId] = useState<number | null>(null);
  const [clearTargetThreadId, setClearTargetThreadId] = useState<number | null>(null);
  const [leaveTargetThreadId, setLeaveTargetThreadId] = useState<number | null>(null);

  const [inlineErrors, setInlineErrors] = useState<InlineActionErrors>({});
  const retryActionsRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const lockedScrollYRef = useRef(0);
  const mobileSheetDragStartYRef = useRef<number | null>(null);
  const mobileSheetDragDistanceRef = useRef(0);
  const mobileSheetCloseTimerRef = useRef<number | null>(null);
  const activeSectionIndex = Math.max(
    0,
    SIDEBAR_SECTIONS.findIndex((section) => section.key === activeSection),
  );

  const { data: friends = [], isLoading: isFriendsLoading } = useFriends(currentUserId);
  const { data: directThreads = [], isLoading: isDirectThreadsLoading } =
    useChatDirectThreads(currentUserId);
  const { data: groupThreads = [], isLoading: isGroupThreadsLoading } =
    useChatGroupThreads(currentUserId);
  const { data: pendingInvites = [], isLoading: isInvitesLoading } =
    usePendingGroupInvites(currentUserId);
  const { data: chatUsers = [] } = useChatUsers(currentUserId);

  const { data: receivedRequests = [], isLoading: isReceivedRequestsLoading } =
    useFriendRequests(FRIEND_REQUEST_DIRECTION.RECEIVED, currentUserId);
  const { data: sentRequests = [], isLoading: isSentRequestsLoading } =
    useFriendRequests(FRIEND_REQUEST_DIRECTION.SENT, currentUserId);

  const createFriendRequestMutation = useCreateFriendRequest(currentUserId);
  const acceptFriendRequestMutation = useAcceptFriendRequest(currentUserId);
  const rejectFriendRequestMutation = useRejectFriendRequest(currentUserId);
  const cancelFriendRequestMutation = useCancelFriendRequest(currentUserId);
  const removeFriendMutation = useRemoveFriend(currentUserId);
  const blockUserMutation = useBlockUser(currentUserId);

  const createDirectMutation = useCreateDirectConversation(currentUserId);
  const createConversationMutation = useCreateConversation(currentUserId);
  const hideThreadMutation = useHideThread(currentUserId);
  const unhideThreadMutation = useUnhideThread(currentUserId);
  const clearMyMessagesMutation = useClearMyThreadMessages(currentUserId);
  const leaveGroupMutation = useLeaveGroupConversation(currentUserId);

  const createGroupInvitesMutation = useCreateGroupInvites(currentUserId);
  const acceptInviteMutation = useAcceptGroupInvite(currentUserId);
  const rejectInviteMutation = useRejectGroupInvite(currentUserId);

  const isLoadingAnyFriendRequestMutation =
    acceptFriendRequestMutation.isPending ||
    rejectFriendRequestMutation.isPending ||
    cancelFriendRequestMutation.isPending;

  const isLoadingAnyThreadActionMutation =
    hideThreadMutation.isPending ||
    clearMyMessagesMutation.isPending ||
    unhideThreadMutation.isPending;

  const syncConversationSearchParam = (threadId?: number) => {
    const currentConversationId = searchParams.get("conversationId");
    const nextConversationId =
      typeof threadId === "number" ? String(threadId) : null;

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

  const setActionError = (
    key: string,
    message: string,
    retryAction: () => Promise<void>,
  ) => {
    retryActionsRef.current.set(key, retryAction);
    setInlineErrors((prev) => ({
      ...prev,
      [key]: message,
    }));
  };

  const clearActionError = (key: string) => {
    retryActionsRef.current.delete(key);
    setInlineErrors((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  };

  const retryInlineAction = async (key: string) => {
    const action = retryActionsRef.current.get(key);
    if (!action) return;

    try {
      await action();
      clearActionError(key);
    } catch {
      // noop: 에러 메시지는 기존 inline 에러를 유지한다.
    }
  };

  const runWithActionRetry = async (
    key: string,
    fallbackMessage: string,
    action: () => Promise<void>,
  ) => {
    clearActionError(key);

    try {
      await action();
    } catch (error) {
      const message = toActionErrorMessage(error, fallbackMessage);
      setActionError(key, message, action);
      showErrorToast(message);
      throw error;
    }
  };

  const acceptedFriends = useMemo(
    () =>
      friends.filter((friend) => friend.status === FRIEND_RELATION_STATUS.ACCEPTED),
    [friends],
  );

  const acceptedFriendIdSet = useMemo(
    () => new Set(acceptedFriends.map((friend) => friend.userId)),
    [acceptedFriends],
  );

  const isThreadHidden = (thread: {
    id: number;
    hidden?: boolean;
    membershipState?: string;
  }) => {
    return (
      Boolean(thread.hidden) ||
      thread.membershipState === CHAT_MEMBERSHIP_STATE.HIDDEN ||
      hiddenThreadIds.has(thread.id)
    );
  };

  const visibleDirectThreads = useMemo(
    () => directThreads.filter((thread) => !isThreadHidden(thread)),
    [directThreads, hiddenThreadIds],
  );

  const hiddenDirectThreads = useMemo(
    () => directThreads.filter((thread) => isThreadHidden(thread)),
    [directThreads, hiddenThreadIds],
  );

  const visibleGroupThreads = useMemo(
    () => groupThreads.filter((thread) => !isThreadHidden(thread)),
    [groupThreads, hiddenThreadIds],
  );

  const allThreads = useMemo(
    () => [...directThreads, ...groupThreads],
    [directThreads, groupThreads],
  );

  const threadById = useMemo(() => {
    return allThreads.reduce<Record<number, (typeof allThreads)[number]>>((acc, thread) => {
      acc[thread.id] = thread;
      return acc;
    }, {});
  }, [allThreads]);

  const selectedThread =
    typeof activeThreadId === "number" ? threadById[activeThreadId] : undefined;

  const selectedThreadTitle = extractThreadTitle(selectedThread);

  const hideTargetThread =
    typeof hideTargetThreadId === "number"
      ? threadById[hideTargetThreadId]
      : undefined;
  const leaveTargetThread =
    typeof leaveTargetThreadId === "number"
      ? threadById[leaveTargetThreadId]
      : undefined;

  const friendSearchCandidates = useMemo(() => {
    const keyword = friendSearchKeyword.trim().toLowerCase();
    return chatUsers
      .filter((chatUser) => chatUser.userId !== currentUserId)
      .filter((chatUser) => !acceptedFriendIdSet.has(chatUser.userId))
      .filter((chatUser) => {
        if (!keyword) return true;
        return userSearchableText(chatUser).includes(keyword);
      });
  }, [acceptedFriendIdSet, chatUsers, currentUserId, friendSearchKeyword]);

  const createGroupParticipantCandidates = useMemo(() => {
    const keyword = createGroupSearchKeyword.trim().toLowerCase();
    return acceptedFriends.filter((friend) => {
      if (!keyword) return true;
      return userSearchableText(friend).includes(keyword);
    });
  }, [acceptedFriends, createGroupSearchKeyword]);

  const inviteTargetThread =
    typeof inviteTargetThreadId === "number"
      ? threadById[inviteTargetThreadId]
      : undefined;

  const inviteCandidateFriends = useMemo(() => {
    const participantSet = new Set<number>(
      inviteTargetThread?.participantUserIds || [],
    );
    const keyword = inviteSearchKeyword.trim().toLowerCase();

    return acceptedFriends.filter((friend) => {
      if (participantSet.has(friend.userId)) return false;
      if (!keyword) return true;
      return userSearchableText(friend).includes(keyword);
    });
  }, [acceptedFriends, inviteSearchKeyword, inviteTargetThread?.participantUserIds]);

  const userDisplayNames = useMemo(() => {
    return chatUsers.reduce<Record<number, string>>((acc, chatUser) => {
      const label = userLabel(chatUser);
      if (label) acc[chatUser.userId] = label;
      return acc;
    }, {});
  }, [chatUsers]);

  const hideTargetThreadTitle = extractThreadTitle(hideTargetThread);
  const leaveTargetThreadTitle = extractThreadTitle(leaveTargetThread);

  useEffect(() => {
    if (typeof currentUserId !== "number") return;
    if (getUserId() === currentUserId) return;
    setUserId(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const rawConversationId = searchParams.get("conversationId");
    if (!rawConversationId) {
      if (typeof activeThreadId === "number" && !isMobile) {
        chatUiStoreActions.setActiveThreadId(undefined);
      }
      return;
    }

    const parsedConversationId = Number(rawConversationId);
    if (!Number.isFinite(parsedConversationId)) return;
    if (activeThreadId === parsedConversationId) return;

    chatUiStoreActions.setActiveThreadId(parsedConversationId);
  }, [activeThreadId, isMobile, searchParams]);

  useEffect(() => {
    if (typeof activeThreadId !== "number") return;
    if (threadById[activeThreadId]) return;

    chatUiStoreActions.setActiveThreadId(undefined);
    syncConversationSearchParam(undefined);
  }, [activeThreadId, threadById]);

  const selectSidebarSection = (section: ChatSidebarSection) => {
    chatUiStoreActions.setActiveSection(section);
  };

  const selectThread = (threadId: number, section?: ChatSidebarSection) => {
    if (section) {
      chatUiStoreActions.setActiveSection(section);
    }

    chatUiStoreActions.markThreadVisible(threadId);
    chatUiStoreActions.clearThreadResurfaced(threadId);
    chatUiStoreActions.setActiveThreadId(threadId);
    syncConversationSearchParam(threadId);
  };

  const clearSelectedThread = () => {
    chatUiStoreActions.setActiveThreadId(undefined);
    syncConversationSearchParam(undefined);
  };

  const handleStartDirectConversation = async (friendUserId: number) => {
    if (!canStartDirectChat(friends, friendUserId)) {
      showErrorToast("친구 관계가 아닌 사용자와는 1:1 대화를 시작할 수 없습니다.");
      return;
    }

    try {
      const created = await createDirectMutation.mutateAsync(friendUserId);
      selectThread(created.id, CHAT_SIDEBAR_SECTION.DIRECT);
      showSuccessToast("1:1 대화를 시작했습니다.");
    } catch (error) {
      showErrorToast(toActionErrorMessage(error, "1:1 대화방 생성에 실패했습니다."));
    }
  };

  const toggleCreateGroupParticipant = (userId: number) => {
    setCreateGroupParticipantIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const resetMobileSheetDragState = () => {
    mobileSheetDragStartYRef.current = null;
    mobileSheetDragDistanceRef.current = 0;
    setIsMobileSheetDragging(false);
    setMobileSheetDragY(0);
  };

  const runMobileSheetClose = (
    sheet: MobileSheetKind,
    finalize: () => void,
  ) => {
    if (!isMobile) {
      resetMobileSheetDragState();
      setClosingMobileSheet(null);
      finalize();
      return;
    }

    if (mobileSheetCloseTimerRef.current !== null) {
      window.clearTimeout(mobileSheetCloseTimerRef.current);
    }

    setIsMobileSheetDragging(false);
    setClosingMobileSheet(sheet);
    mobileSheetCloseTimerRef.current = window.setTimeout(() => {
      setClosingMobileSheet(null);
      resetMobileSheetDragState();
      finalize();
      mobileSheetCloseTimerRef.current = null;
    }, MOBILE_SHEET_EXIT_DURATION_MS);
  };

  const closeFriendAddModal = () => {
    runMobileSheetClose("friend-add", () => {
      setIsFriendAddModalOpen(false);
      setFriendSearchKeyword("");
    });
  };

  const openFriendAddModal = () => {
    if (mobileSheetCloseTimerRef.current !== null) {
      window.clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setClosingMobileSheet(null);
    resetMobileSheetDragState();
    setIsFriendAddModalOpen(true);
  };

  const resetCreateGroupModal = () => {
    runMobileSheetClose("create-group", () => {
      setCreateGroupTitle("");
      setCreateGroupSearchKeyword("");
      setCreateGroupParticipantIds([]);
      setIsCreateGroupModalOpen(false);
    });
  };

  const openCreateGroupModal = () => {
    if (mobileSheetCloseTimerRef.current !== null) {
      window.clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setClosingMobileSheet(null);
    setIsFriendAddModalOpen(false);
    resetMobileSheetDragState();
    setCreateGroupTitle("");
    setCreateGroupSearchKeyword("");
    setCreateGroupParticipantIds([]);
    setIsCreateGroupModalOpen(true);
  };

  const handleCreateGroupConversation = async () => {
    if (createGroupParticipantIds.length === 0) {
      showErrorToast("그룹 채팅 멤버를 1명 이상 선택해주세요.");
      return;
    }

    try {
      const created = await createConversationMutation.mutateAsync({
        type: CHAT_THREAD_TYPE.GROUP,
        title: createGroupTitle.trim() || undefined,
        participantUserIds: createGroupParticipantIds,
      });
      resetCreateGroupModal();
      selectThread(created.id, CHAT_SIDEBAR_SECTION.GROUP);
      showSuccessToast("새 그룹 채팅방을 만들었습니다.");
    } catch (error) {
      showErrorToast(toActionErrorMessage(error, "그룹 채팅 생성에 실패했습니다."));
    }
  };

  const toggleInviteTargetUser = (userId: number) => {
    setInviteTargetUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const resetGroupInviteModal = () => {
    runMobileSheetClose("group-invite", () => {
      setInviteTargetThreadId(null);
      setInviteSearchKeyword("");
      setInviteTargetUserIds([]);
    });
  };

  const openGroupInviteModal = (threadId: number) => {
    if (mobileSheetCloseTimerRef.current !== null) {
      window.clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setClosingMobileSheet(null);
    resetMobileSheetDragState();
    setInviteTargetThreadId(threadId);
    setInviteSearchKeyword("");
    setInviteTargetUserIds([]);
  };

  const handleCreateGroupInvite = async () => {
    if (!inviteTargetThread) return;
    if (inviteTargetUserIds.length === 0) {
      showErrorToast("초대할 친구를 1명 이상 선택해주세요.");
      return;
    }

    const groupId = inviteTargetThread.groupId ?? inviteTargetThread.id;

    try {
      await createGroupInvitesMutation.mutateAsync({
        groupId,
        targetUserIds: inviteTargetUserIds,
      });
      resetGroupInviteModal();
      showSuccessToast("그룹 초대를 전송했습니다.");
    } catch (error) {
      showErrorToast(toActionErrorMessage(error, "그룹 초대 전송에 실패했습니다."));
    }
  };

  const openHideDialog = (threadId: number) => {
    if (isLoadingAnyThreadActionMutation) return;
    setHideTargetThreadId(threadId);
  };

  const closeHideDialog = () => {
    if (hideThreadMutation.isPending) return;
    setHideTargetThreadId(null);
  };

  const openClearDialog = (threadId: number) => {
    if (isLoadingAnyThreadActionMutation) return;
    setClearTargetThreadId(threadId);
  };

  const closeClearDialog = () => {
    if (clearMyMessagesMutation.isPending) return;
    setClearTargetThreadId(null);
  };

  const openLeaveGroupDialog = (threadId: number) => {
    if (leaveGroupMutation.isPending) return;
    setLeaveTargetThreadId(threadId);
  };

  const closeLeaveGroupDialog = () => {
    if (leaveGroupMutation.isPending) return;
    setLeaveTargetThreadId(null);
  };

  const handleConfirmHideThread = async () => {
    if (typeof hideTargetThreadId !== "number") return;

    const threadId = hideTargetThreadId;
    const key = `thread-hide-${threadId}`;

    try {
      await runWithActionRetry(
        key,
        "대화 숨기기에 실패했습니다.",
        async () => {
          await hideThreadMutation.mutateAsync(threadId);
        },
      );

      chatUiStoreActions.markThreadHidden(threadId);
      if (activeThreadId === threadId) {
        clearSelectedThread();
      }

      setHideTargetThreadId(null);
      showSuccessToast("대화를 숨겼습니다.");
    } catch {
      // noop
    }
  };

  const handleConfirmClearMyMessages = async () => {
    if (typeof clearTargetThreadId !== "number") return;

    const threadId = clearTargetThreadId;
    const key = `thread-clear-${threadId}`;

    try {
      await runWithActionRetry(
        key,
        "내 메시지 기록 삭제에 실패했습니다.",
        async () => {
          await clearMyMessagesMutation.mutateAsync(threadId);
        },
      );

      setClearTargetThreadId(null);
      showSuccessToast("내 메시지 기록을 삭제했습니다.");
    } catch {
      // noop
    }
  };

  const handleConfirmLeaveGroup = async () => {
    if (typeof leaveTargetThreadId !== "number") return;

    const thread = threadById[leaveTargetThreadId];
    if (!thread) {
      setLeaveTargetThreadId(null);
      return;
    }

    const threadId = thread.id;
    const groupId = thread.groupId ?? thread.id;

    try {
      await leaveGroupMutation.mutateAsync({
        threadId,
        groupId,
      });

      unsubscribeChat(threadId);

      if (activeThreadId === threadId) {
        clearSelectedThread();
      }

      setLeaveTargetThreadId(null);
      showSuccessToast("그룹 채팅방에서 나갔습니다.");
    } catch (error) {
      showErrorToast(toActionErrorMessage(error, "그룹 채팅방 나가기에 실패했습니다."));
    }
  };

  const handleUnhideThread = async (threadId: number) => {
    const key = `thread-unhide-${threadId}`;

    try {
      await runWithActionRetry(
        key,
        "숨김 해제에 실패했습니다.",
        async () => {
          await unhideThreadMutation.mutateAsync(threadId);
        },
      );

      chatUiStoreActions.markThreadVisible(threadId);
      showSuccessToast("대화 숨김을 해제했습니다.");
    } catch {
      // noop
    }
  };

  const handleCreateFriendRequest = async (targetUserId: number) => {
    const key = `friend-request-create-${targetUserId}`;

    try {
      await runWithActionRetry(
        key,
        "친구 요청 전송에 실패했습니다.",
        async () => {
          await createFriendRequestMutation.mutateAsync(targetUserId);
        },
      );
      showSuccessToast("친구 요청을 전송했습니다.");
    } catch {
      // noop
    }
  };

  const handleAcceptFriendRequest = async (requestId: number) => {
    const key = `friend-request-accept-${requestId}`;

    try {
      await runWithActionRetry(
        key,
        "친구 요청 수락에 실패했습니다.",
        async () => {
          await acceptFriendRequestMutation.mutateAsync(requestId);
        },
      );
      showSuccessToast("친구 요청을 수락했습니다.");
    } catch {
      // noop
    }
  };

  const handleRejectFriendRequest = async (requestId: number) => {
    const key = `friend-request-reject-${requestId}`;

    try {
      await runWithActionRetry(
        key,
        "친구 요청 거절에 실패했습니다.",
        async () => {
          await rejectFriendRequestMutation.mutateAsync(requestId);
        },
      );
      showSuccessToast("친구 요청을 거절했습니다.");
    } catch {
      // noop
    }
  };

  const handleCancelFriendRequest = async (requestId: number) => {
    const key = `friend-request-cancel-${requestId}`;

    try {
      await runWithActionRetry(
        key,
        "보낸 요청 취소에 실패했습니다.",
        async () => {
          await cancelFriendRequestMutation.mutateAsync(requestId);
        },
      );
      showSuccessToast("보낸 요청을 취소했습니다.");
    } catch {
      // noop
    }
  };

  const handleRemoveFriend = async (friendUserId: number) => {
    const key = `friend-remove-${friendUserId}`;

    try {
      await runWithActionRetry(
        key,
        "친구 삭제에 실패했습니다.",
        async () => {
          await removeFriendMutation.mutateAsync(friendUserId);
        },
      );
      showSuccessToast("친구를 삭제했습니다.");
    } catch {
      // noop
    }
  };

  const handleBlockUser = async (targetUserId: number) => {
    const key = `friend-block-${targetUserId}`;

    try {
      await runWithActionRetry(
        key,
        "사용자 차단에 실패했습니다.",
        async () => {
          await blockUserMutation.mutateAsync(targetUserId);
        },
      );
      showSuccessToast("사용자를 차단했습니다.");
    } catch {
      // noop
    }
  };

  const handleAcceptGroupInvite = async (inviteId: number) => {
    const key = `invite-accept-${inviteId}`;

    try {
      await runWithActionRetry(
        key,
        "그룹 초대 수락에 실패했습니다.",
        async () => {
          await acceptInviteMutation.mutateAsync(inviteId);
        },
      );
      showSuccessToast("그룹 초대를 수락했습니다.");
    } catch {
      // noop
    }
  };

  const handleRejectGroupInvite = async (inviteId: number) => {
    const key = `invite-reject-${inviteId}`;

    try {
      await runWithActionRetry(
        key,
        "그룹 초대 거절에 실패했습니다.",
        async () => {
          await rejectInviteMutation.mutateAsync(inviteId);
        },
      );
      showSuccessToast("그룹 초대를 거절했습니다.");
    } catch {
      // noop
    }
  };

  const renderInlineError = (key: string) => {
    const message = inlineErrors[key];
    if (!message) return null;

    return (
      <div className="mt-2 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
        <p className="line-clamp-2 pr-2">{message}</p>
        <button
          type="button"
          className="shrink-0 rounded-md border border-rose-300 px-1.5 py-0.5 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
          onClick={() => {
            void retryInlineAction(key);
          }}
        >
          재시도
        </button>
      </div>
    );
  };

  const sidebarHeader = (
    <div className="space-y-3 border-b border-slate-200 px-3 py-3 dark:border-slate-700">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Conversation Deck
        </p>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          대화 라운지
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          친구, 개인/그룹 채팅, 초대를 한 번에 관리합니다.
        </p>
      </div>
      <div className="relative grid grid-cols-4 gap-1 overflow-hidden rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <span
          className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-white shadow-sm transition-transform duration-300 ease-out dark:bg-slate-900"
          style={{
            width: "calc((100% - 1.25rem) / 4)",
            transform: `translateX(calc(${activeSectionIndex} * (100% + 0.25rem)))`,
          }}
          aria-hidden="true"
        />
        {SIDEBAR_SECTIONS.map((section) => {
          const isActive = activeSection === section.key;
          const showInviteBadge =
            section.key === CHAT_SIDEBAR_SECTION.INVITES && pendingInvites.length > 0;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => selectSidebarSection(section.key)}
              className={[
                "relative z-10 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors duration-200",
                isActive
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100",
              ].join(" ")}
            >
              {section.label}
              {showInviteBadge && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {pendingInvites.length > 99 ? "99+" : pendingInvites.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const friendsSection = (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">친구 목록</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            openFriendAddModal();
          }}
          className="h-8 rounded-lg px-2 text-xs"
        >
          + 친구 추가
        </Button>
      </div>

      <div className="space-y-2">
        {isFriendsLoading && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            친구 목록을 불러오는 중...
          </p>
        )}
        {!isFriendsLoading && acceptedFriends.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            아직 친구가 없습니다.
          </p>
        )}

        {acceptedFriends.map((friend) => {
          const removeKey = `friend-remove-${friend.userId}`;
          return (
            <div
              key={friend.userId}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {userSubLabel(friend)}
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    FRIEND_STATUS_STYLE[friend.status],
                  ].join(" ")}
                >
                  {FRIEND_STATUS_LABEL[friend.status]}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void handleStartDirectConversation(friend.userId);
                  }}
                  className="h-8 rounded-lg px-2 text-xs"
                  isLoading={
                    createDirectMutation.isPending &&
                    createDirectMutation.variables === friend.userId
                  }
                  loadingText="시작 중..."
                >
                  1:1 시작
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-rose-200 px-2 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  onClick={() => {
                    void handleRemoveFriend(friend.userId);
                  }}
                  isLoading={
                    removeFriendMutation.isPending &&
                    removeFriendMutation.variables === friend.userId
                  }
                  loadingText="삭제 중..."
                >
                  친구 삭제
                </Button>
              </div>
              {renderInlineError(removeKey)}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          받은 요청
        </p>
        {isReceivedRequestsLoading && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            받은 요청을 불러오는 중...
          </p>
        )}
        {!isReceivedRequestsLoading && receivedRequests.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            받은 친구 요청이 없습니다.
          </p>
        )}

        {receivedRequests.map((request) => {
          const acceptKey = `friend-request-accept-${request.requestId}`;
          const rejectKey = `friend-request-reject-${request.requestId}`;
          const blockKey = `friend-block-${request.requester.userId}`;

          return (
            <div
              key={request.requestId}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {userLabel(request.requester)}
                  </p>
                  {userSubLabel(request.requester) && (
                    <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                      {userSubLabel(request.requester)}
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    FRIEND_STATUS_STYLE[request.status],
                  ].join(" ")}
                >
                  {FRIEND_STATUS_LABEL[request.status]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg px-2 text-xs"
                  disabled={isLoadingAnyFriendRequestMutation}
                  onClick={() => {
                    void handleAcceptFriendRequest(request.requestId);
                  }}
                >
                  수락
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg px-2 text-xs"
                  disabled={isLoadingAnyFriendRequestMutation}
                  onClick={() => {
                    void handleRejectFriendRequest(request.requestId);
                  }}
                >
                  거절
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-rose-200 px-2 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  disabled={blockUserMutation.isPending}
                  onClick={() => {
                    void handleBlockUser(request.requester.userId);
                  }}
                >
                  차단
                </Button>
              </div>

              {renderInlineError(acceptKey)}
              {renderInlineError(rejectKey)}
              {renderInlineError(blockKey)}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          보낸 요청
        </p>
        {isSentRequestsLoading && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            보낸 요청을 불러오는 중...
          </p>
        )}
        {!isSentRequestsLoading && sentRequests.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            보낸 친구 요청이 없습니다.
          </p>
        )}

        {sentRequests.map((request) => {
          const cancelKey = `friend-request-cancel-${request.requestId}`;
          return (
            <div
              key={request.requestId}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {userLabel(request.target)}
                  </p>
                  {userSubLabel(request.target) && (
                    <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                      {userSubLabel(request.target)}
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    FRIEND_STATUS_STYLE[request.status],
                  ].join(" ")}
                >
                  {FRIEND_STATUS_LABEL[request.status]}
                </span>
              </div>

              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg px-2 text-xs"
                  disabled={cancelFriendRequestMutation.isPending}
                  onClick={() => {
                    void handleCancelFriendRequest(request.requestId);
                  }}
                >
                  요청 취소
                </Button>
              </div>
              {renderInlineError(cancelKey)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const directSection = (
    <div className="space-y-3 p-3">
      <Input
        value={directSearchKeyword}
        onChange={(event) => setDirectSearchKeyword(event.target.value)}
        placeholder="개인 대화 검색"
        className="h-9 rounded-lg text-xs"
      />

      <SurfaceCard
        padded="none"
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <ConversationList
          conversations={visibleDirectThreads}
          selectedConversationId={activeThreadId}
          onSelect={(threadId) => selectThread(threadId, CHAT_SIDEBAR_SECTION.DIRECT)}
          onRequestHideThread={openHideDialog}
          onRequestClearMyMessages={openClearDialog}
          hidingThreadId={
            hideThreadMutation.isPending ? hideThreadMutation.variables : undefined
          }
          clearingThreadId={
            clearMyMessagesMutation.isPending
              ? clearMyMessagesMutation.variables
              : undefined
          }
          isLoading={isDirectThreadsLoading}
          searchKeyword={directSearchKeyword}
          resurfacedThreadIds={resurfacedThreadIds}
        />
      </SurfaceCard>

      {hiddenDirectThreads.length > 0 && (
        <SurfaceCard className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            숨긴 대화 {hiddenDirectThreads.length}개
          </p>
          <div className="space-y-2">
            {hiddenDirectThreads.map((thread) => {
              const unhideKey = `thread-unhide-${thread.id}`;
              return (
                <div
                  key={thread.id}
                  className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {extractThreadTitle(thread)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      onClick={() => {
                        void handleUnhideThread(thread.id);
                      }}
                      isLoading={
                        unhideThreadMutation.isPending &&
                        unhideThreadMutation.variables === thread.id
                      }
                      loadingText="복구 중..."
                    >
                      숨김 해제
                    </Button>
                  </div>
                  {renderInlineError(unhideKey)}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}
    </div>
  );

  const groupSection = (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">그룹 채팅방</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg px-2 text-xs"
          onClick={() => {
            openCreateGroupModal();
          }}
        >
          + 새 그룹
        </Button>
      </div>

      <Input
        value={groupSearchKeyword}
        onChange={(event) => setGroupSearchKeyword(event.target.value)}
        placeholder="그룹 대화 검색"
        className="h-9 rounded-lg text-xs"
      />

      <SurfaceCard
        padded="none"
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <ConversationList
          conversations={visibleGroupThreads}
          selectedConversationId={activeThreadId}
          onSelect={(threadId) => selectThread(threadId, CHAT_SIDEBAR_SECTION.GROUP)}
          onRequestLeaveGroup={openLeaveGroupDialog}
          leavingGroupThreadId={
            leaveGroupMutation.isPending
              ? leaveGroupMutation.variables?.threadId
              : undefined
          }
          isLoading={isGroupThreadsLoading}
          searchKeyword={groupSearchKeyword}
        />
      </SurfaceCard>
    </div>
  );

  const invitesSection = (
    <div className="space-y-3 p-3">
      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">초대 수신함</p>

      {isInvitesLoading && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          초대 목록을 불러오는 중...
        </p>
      )}

      {!isInvitesLoading && pendingInvites.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          대기 중인 그룹 초대가 없습니다.
        </p>
      )}

      <div className="space-y-2">
        {pendingInvites.map((invite) => {
          const acceptKey = `invite-accept-${invite.inviteId}`;
          const rejectKey = `invite-reject-${invite.inviteId}`;

          return (
            <div
              key={invite.inviteId}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {invite.groupName || `그룹 ${invite.groupId}`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                초대한 사람: {userLabel(invite.inviter)}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg px-2 text-xs"
                  disabled={acceptInviteMutation.isPending || rejectInviteMutation.isPending}
                  onClick={() => {
                    void handleAcceptGroupInvite(invite.inviteId);
                  }}
                >
                  수락
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg px-2 text-xs"
                  disabled={acceptInviteMutation.isPending || rejectInviteMutation.isPending}
                  onClick={() => {
                    void handleRejectGroupInvite(invite.inviteId);
                  }}
                >
                  거절
                </Button>
              </div>

              {renderInlineError(acceptKey)}
              {renderInlineError(rejectKey)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const sideSectionContent =
    activeSection === CHAT_SIDEBAR_SECTION.FRIENDS
      ? friendsSection
      : activeSection === CHAT_SIDEBAR_SECTION.DIRECT
        ? directSection
        : activeSection === CHAT_SIDEBAR_SECTION.GROUP
          ? groupSection
          : invitesSection;

  const selectedThreadType = selectedThread?.type;
  const isMobileThreadOpen = isMobile && Boolean(selectedThread);
  const isFriendAddModalVisible =
    isFriendAddModalOpen || closingMobileSheet === "friend-add";
  const isCreateGroupModalVisible =
    isCreateGroupModalOpen || closingMobileSheet === "create-group";
  const isGroupInviteModalVisible =
    inviteTargetThread !== null || closingMobileSheet === "group-invite";
  const isAnyMobileModalOpen =
    isFriendAddModalVisible ||
    isCreateGroupModalVisible ||
    isGroupInviteModalVisible;
  const mobileSheetInlineStyle =
    isMobile && (isMobileSheetDragging || mobileSheetDragY > 0 || closingMobileSheet)
      ? ({
          "--mobile-sheet-close-from": `${mobileSheetDragY}px`,
          transform: `translateY(${mobileSheetDragY}px)`,
          transitionDuration: isMobileSheetDragging ? "0ms" : "200ms",
        } as CSSProperties)
      : undefined;
  const mobileViewportHeight = useMobileVisualViewportHeight(isMobileThreadOpen);
  const mobileThreadShellStyle = isMobileThreadOpen
    ? {
        top: "0px",
        height: `${mobileViewportHeight}px`,
      }
    : undefined;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (typeof window === "undefined") return;
    if (!isMobileThreadOpen && !isAnyMobileModalOpen) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    if (isAnyMobileModalOpen) {
      lockedScrollYRef.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollYRef.current}px`;
      document.body.style.width = "100%";
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      if (isAnyMobileModalOpen) {
        window.scrollTo({ top: lockedScrollYRef.current, behavior: "auto" });
      }
    };
  }, [isAnyMobileModalOpen, isMobileThreadOpen]);

  const closeActiveMobileSheet = () => {
    if (inviteTargetThread) {
      resetGroupInviteModal();
      return;
    }
    if (isCreateGroupModalOpen) {
      resetCreateGroupModal();
      return;
    }
    if (isFriendAddModalOpen) {
      closeFriendAddModal();
    }
  };

  const handleMobileSheetTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile || event.touches.length !== 1) return;
    mobileSheetDragStartYRef.current = event.touches[0].clientY;
    mobileSheetDragDistanceRef.current = 0;
    setIsMobileSheetDragging(true);
  };

  const handleMobileSheetTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile || mobileSheetDragStartYRef.current === null) return;
    const delta = event.touches[0].clientY - mobileSheetDragStartYRef.current;
    const next = Math.max(0, delta);
    mobileSheetDragDistanceRef.current = next;
    setMobileSheetDragY(next);
  };

  const handleMobileSheetTouchEnd = () => {
    if (!isMobile || mobileSheetDragStartYRef.current === null) return;
    const shouldClose = mobileSheetDragDistanceRef.current > 96;
    resetMobileSheetDragState();
    if (shouldClose) {
      closeActiveMobileSheet();
    }
  };

  const chatRoomPanel = selectedThread ? (
    <ChatRoom
      conversationId={selectedThread.id}
      currentUserId={currentUserId}
      conversationTitle={selectedThreadTitle || "이름 없는 대화"}
      conversationType={selectedThread.type}
      userDisplayNames={userDisplayNames}
      onBack={isMobile ? clearSelectedThread : undefined}
      onRequestHideThread={
        selectedThreadType === CHAT_THREAD_TYPE.DIRECT ? openHideDialog : undefined
      }
      onRequestClearMyMessages={
        selectedThreadType === CHAT_THREAD_TYPE.DIRECT ? openClearDialog : undefined
      }
      onRequestLeaveGroup={
        selectedThreadType === CHAT_THREAD_TYPE.GROUP ? openLeaveGroupDialog : undefined
      }
      onRequestInviteMembers={
        selectedThreadType === CHAT_THREAD_TYPE.GROUP
          ? openGroupInviteModal
          : undefined
      }
      isLeavingGroup={
        selectedThreadType === CHAT_THREAD_TYPE.GROUP &&
        leaveGroupMutation.isPending &&
        leaveGroupMutation.variables?.threadId === selectedThread.id
      }
      isHidingThread={
        hideThreadMutation.isPending && hideThreadMutation.variables === selectedThread.id
      }
      isClearingMyMessages={
        clearMyMessagesMutation.isPending &&
        clearMyMessagesMutation.variables === selectedThread.id
      }
      isMobileFullscreen={isMobile}
      className={
        isMobile
          ? "mt-2 h-[calc(100%-0.5rem)] rounded-none border-x-0 border-t-0"
          : undefined
      }
    />
  ) : (
    <SurfaceCard className="flex h-[72vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      친구 목록에서 1:1을 시작하거나, 좌측 섹션에서 대화를 선택하세요.
    </SurfaceCard>
  );

  const mobileSidebarPanel = (
    <SurfaceCard
      padded="none"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div
        className="flex flex-col"
        style={{
          minHeight: `calc(100dvh - ${MOBILE_CHAT_LIST_VIEWPORT_OFFSET})`,
          maxHeight: `calc(100dvh - ${MOBILE_CHAT_LIST_VIEWPORT_OFFSET})`,
        }}
      >
        {sidebarHeader}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: MOBILE_CHAT_LIST_BOTTOM_PADDING }}
        >
          {sideSectionContent}
        </div>
      </div>
    </SurfaceCard>
  );

  useEffect(() => {
    return () => {
      if (mobileSheetCloseTimerRef.current !== null) {
        window.clearTimeout(mobileSheetCloseTimerRef.current);
      }
    };
  }, []);

  const friendAddModal =
    isFriendAddModalVisible && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[180] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div
              aria-hidden="true"
              className={[
                "absolute inset-0 bg-slate-900/45",
                isMobile
                  ? closingMobileSheet === "friend-add"
                    ? "mobile-sheet-overlay-exit"
                    : "mobile-sheet-overlay-enter"
                  : "animate-in fade-in-0 duration-200 ease-out",
              ].join(" ")}
              onClick={closeFriendAddModal}
            />
            <div
              className={[
                "relative w-full rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900",
                isMobile
                  ? closingMobileSheet === "friend-add"
                    ? "mobile-sheet-exit"
                    : "mobile-sheet-enter"
                  : "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
              ].join(" ")}
              style={mobileSheetInlineStyle}
            >
              {isMobile && (
                <div
                  className="mb-3 touch-none rounded-t-3xl bg-white px-4 pt-2 dark:bg-slate-900"
                  onTouchStart={handleMobileSheetTouchStart}
                  onTouchMove={handleMobileSheetTouchMove}
                  onTouchEnd={handleMobileSheetTouchEnd}
                  onTouchCancel={resetMobileSheetDragState}
                >
                  <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">친구 추가</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    닉네임으로 친구를 찾아 요청을 전송하세요.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  onClick={closeFriendAddModal}
                >
                  닫기
                </button>
              </div>

              <Input
                value={friendSearchKeyword}
                onChange={(event) => setFriendSearchKeyword(event.target.value)}
                placeholder="닉네임 검색"
              />

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                {friendSearchCandidates.length === 0 && (
                  <p className="p-3 text-xs text-slate-500 dark:text-slate-400">
                    검색 결과가 없습니다.
                  </p>
                )}

                {friendSearchCandidates.map((candidate) => {
                  const createKey = `friend-request-create-${candidate.userId}`;
                  return (
                    <div
                      key={candidate.userId}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {userLabel(candidate)}
                          </p>
                          {userSubLabel(candidate) && (
                            <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                              {userSubLabel(candidate)}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg px-2 text-xs"
                          onClick={() => {
                            void handleCreateFriendRequest(candidate.userId);
                          }}
                          isLoading={
                            createFriendRequestMutation.isPending &&
                            createFriendRequestMutation.variables === candidate.userId
                          }
                          loadingText="전송 중..."
                        >
                          요청 전송
                        </Button>
                      </div>
                      {renderInlineError(createKey)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const createGroupModal =
    isCreateGroupModalVisible && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[180] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div
              aria-hidden="true"
              className={[
                "absolute inset-0 bg-slate-900/45",
                isMobile
                  ? closingMobileSheet === "create-group"
                    ? "mobile-sheet-overlay-exit"
                    : "mobile-sheet-overlay-enter"
                  : "animate-in fade-in-0 duration-200 ease-out",
              ].join(" ")}
              onClick={resetCreateGroupModal}
            />
            <div
              className={[
                "relative w-full rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900",
                isMobile
                  ? closingMobileSheet === "create-group"
                    ? "mobile-sheet-exit"
                    : "mobile-sheet-enter"
                  : "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
              ].join(" ")}
              style={mobileSheetInlineStyle}
            >
              {isMobile && (
                <div
                  className="mb-3 touch-none rounded-t-3xl bg-white px-4 pt-2 dark:bg-slate-900"
                  onTouchStart={handleMobileSheetTouchStart}
                  onTouchMove={handleMobileSheetTouchMove}
                  onTouchEnd={handleMobileSheetTouchEnd}
                  onTouchCancel={resetMobileSheetDragState}
                >
                  <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    새 그룹 채팅 생성
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    친구를 선택해 그룹 대화를 시작하세요.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  onClick={resetCreateGroupModal}
                >
                  닫기
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  value={createGroupTitle}
                  onChange={(event) => setCreateGroupTitle(event.target.value)}
                  placeholder="그룹 이름 (선택)"
                />
                <Input
                  value={createGroupSearchKeyword}
                  onChange={(event) => setCreateGroupSearchKeyword(event.target.value)}
                  placeholder="친구 검색"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70">
                  {createGroupParticipantCandidates.length === 0 && (
                    <p className="p-2 text-xs text-slate-500 dark:text-slate-400">
                      선택 가능한 친구가 없습니다.
                    </p>
                  )}
                  {createGroupParticipantCandidates.map((friend) => {
                    const selected = createGroupParticipantIds.includes(friend.userId);
                    return (
                      <button
                        key={friend.userId}
                        type="button"
                        onClick={() => toggleCreateGroupParticipant(friend.userId)}
                        className={[
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                          selected
                            ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-300"
                            : "border-transparent bg-white text-slate-700 hover:border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
                        ].join(" ")}
                      >
                        <div>
                          <p className="text-sm font-semibold">{userLabel(friend)}</p>
                          {userSubLabel(friend) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {userSubLabel(friend)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {selected ? "선택됨" : "선택"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>선택된 멤버: {createGroupParticipantIds.length}명</span>
                  <span>생성 직후 바로 대화 시작</span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  isLoading={createConversationMutation.isPending}
                  loadingText="생성 중..."
                  onClick={() => {
                    void handleCreateGroupConversation();
                  }}
                >
                  그룹 생성
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const groupInviteModal =
    isGroupInviteModalVisible && inviteTargetThread && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[180] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div
              aria-hidden="true"
              className={[
                "absolute inset-0 bg-slate-900/45",
                isMobile
                  ? closingMobileSheet === "group-invite"
                    ? "mobile-sheet-overlay-exit"
                    : "mobile-sheet-overlay-enter"
                  : "animate-in fade-in-0 duration-200 ease-out",
              ].join(" ")}
              onClick={resetGroupInviteModal}
            />
            <div
              className={[
                "relative w-full rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900",
                isMobile
                  ? closingMobileSheet === "group-invite"
                    ? "mobile-sheet-exit"
                    : "mobile-sheet-enter"
                  : "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
              ].join(" ")}
              style={mobileSheetInlineStyle}
            >
              {isMobile && (
                <div
                  className="mb-3 touch-none rounded-t-3xl bg-white px-4 pt-2 dark:bg-slate-900"
                  onTouchStart={handleMobileSheetTouchStart}
                  onTouchMove={handleMobileSheetTouchMove}
                  onTouchEnd={handleMobileSheetTouchEnd}
                  onTouchCancel={resetMobileSheetDragState}
                >
                  <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    멤버 초대
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {extractThreadTitle(inviteTargetThread)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  onClick={resetGroupInviteModal}
                >
                  닫기
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  value={inviteSearchKeyword}
                  onChange={(event) => setInviteSearchKeyword(event.target.value)}
                  placeholder="친구 검색"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70">
                  {inviteCandidateFriends.length === 0 && (
                    <p className="p-2 text-xs text-slate-500 dark:text-slate-400">
                      초대 가능한 친구가 없습니다.
                    </p>
                  )}

                  {inviteCandidateFriends.map((friend) => {
                    const selected = inviteTargetUserIds.includes(friend.userId);
                    return (
                      <button
                        key={friend.userId}
                        type="button"
                        onClick={() => toggleInviteTargetUser(friend.userId)}
                        className={[
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                          selected
                            ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-300"
                            : "border-transparent bg-white text-slate-700 hover:border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
                        ].join(" ")}
                      >
                        <div>
                          <p className="text-sm font-semibold">{userLabel(friend)}</p>
                          {userSubLabel(friend) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {userSubLabel(friend)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {selected ? "선택됨" : "선택"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>선택된 친구: {inviteTargetUserIds.length}명</span>
                  <span>초대 수신함에서 수락/거절 가능</span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  isLoading={createGroupInvitesMutation.isPending}
                  loadingText="전송 중..."
                  onClick={() => {
                    void handleCreateGroupInvite();
                  }}
                >
                  초대 보내기
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={
        isMobileThreadOpen
          ? "fixed inset-x-0 z-[70] overflow-hidden overscroll-none bg-slate-50 dark:bg-slate-950"
          : "space-y-4"
      }
      style={mobileThreadShellStyle}
    >
      {!isMobile && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                메신저
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                친구 기반 1:1, 그룹 채팅, 초대 수신함을 한 화면에서 빠르게 처리합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {isMobile ? (
        selectedThread ? chatRoomPanel : mobileSidebarPanel
      ) : (
        <div
          className={
            isMobile
              ? "mt-2 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"
              : "grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"
          }
        >
          <SurfaceCard
            padded="none"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95"
          >
            {sidebarHeader}
            {sideSectionContent}
          </SurfaceCard>

          <div>{chatRoomPanel}</div>
        </div>
      )}

      <ActionDialog
        open={hideTargetThreadId !== null}
        icon={<EyeOff className="h-5 w-5" aria-hidden="true" />}
        title="대화 숨기기"
        content={hideTargetThreadTitle
          ? `이 대화를 숨기시겠어요?\n${hideTargetThreadTitle}`
          : "이 대화를 숨기시겠어요?"}
        contentClassName="whitespace-pre-line text-sm text-slate-500 dark:text-slate-400"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<EyeOff className="h-4 w-4" aria-hidden="true" />}
        cancelText="취소"
        confirmText={hideThreadMutation.isPending ? "숨기는 중..." : "숨기기"}
        confirmDisabled={hideThreadMutation.isPending}
        cancelDisabled={hideThreadMutation.isPending}
        preventAutoCloseOnConfirm
        onOpenChange={(open) => {
          if (!open) closeHideDialog();
        }}
        onConfirm={() => {
          void handleConfirmHideThread();
        }}
        confirmClassName="bg-blue-600 text-white hover:bg-blue-600 lg:hover:bg-blue-700"
      />

      <ActionDialog
        open={clearTargetThreadId !== null}
        icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
        title="내 메시지 기록 삭제"
        content={"이 대화에서 내 메시지 기록을 삭제하시겠어요?\n삭제해도 상대방의 메시지 기록에는 영향이 없습니다."}
        contentClassName="whitespace-pre-line text-sm text-slate-500 dark:text-slate-400"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        iconWrapperClassName="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
        cancelText="취소"
        confirmText={
          clearMyMessagesMutation.isPending ? "삭제 중..." : "내 기록 삭제"
        }
        confirmDisabled={clearMyMessagesMutation.isPending}
        cancelDisabled={clearMyMessagesMutation.isPending}
        preventAutoCloseOnConfirm
        onOpenChange={(open) => {
          if (!open) closeClearDialog();
        }}
        onConfirm={() => {
          void handleConfirmClearMyMessages();
        }}
        confirmClassName="bg-rose-600 text-white hover:bg-rose-600 lg:hover:bg-rose-700"
      />

      <ActionDialog
        open={leaveTargetThreadId !== null}
        icon={<LogOut className="h-5 w-5" aria-hidden="true" />}
        title="그룹 채팅방 나가기"
        content={leaveTargetThreadTitle
          ? `정말 이 그룹 채팅방을 나가시겠어요?\n${leaveTargetThreadTitle}\n나가면 이 방의 새 메시지를 더 이상 받지 않습니다.`
          : "정말 이 그룹 채팅방을 나가시겠어요?"}
        contentClassName="whitespace-pre-line text-sm text-slate-500 dark:text-slate-400"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
        iconWrapperClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        cancelText="취소"
        confirmText={leaveGroupMutation.isPending ? "나가는 중..." : "나가기"}
        confirmDisabled={leaveGroupMutation.isPending}
        cancelDisabled={leaveGroupMutation.isPending}
        preventAutoCloseOnConfirm
        onOpenChange={(open) => {
          if (!open) closeLeaveGroupDialog();
        }}
        onConfirm={() => {
          void handleConfirmLeaveGroup();
        }}
        confirmClassName="bg-rose-600 text-white hover:bg-rose-600 lg:hover:bg-rose-700"
      />

      {friendAddModal}
      {createGroupModal}
      {groupInviteModal}
    </div>
  );
}
