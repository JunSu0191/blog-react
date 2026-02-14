import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SurfaceCard from "@/shared/ui/SurfaceCard";
import { Button, Input } from "@/shared/ui";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken, getUserId, getUserIdFromToken, setUserId } from "@/shared/lib/auth";
import ConversationList from "../components/ConversationList";
import ChatRoom from "../components/ChatRoom";
import {
  useChatUsers,
  useConversations,
  useCreateConversation,
  useCreateDirectConversation,
} from "../queries";

type MobileChatTab = "conversations" | "direct";

const MOBILE_BREAKPOINT = 1024;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
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
    return (username && uniqueCandidates.has(username)) || (name && uniqueCandidates.has(name));
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

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
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
  const currentUserId = user?.id;
  const isMobile = useIsMobileChatLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = getToken();
  const tokenUserId = useMemo(() => getUserIdFromToken(token) ?? undefined, [token]);
  const tokenPayload = useMemo(() => parseJwtPayload(token), [token]);

  const { data: users = [] } = useChatUsers(currentUserId ?? tokenUserId);

  const effectiveCurrentUserId = useMemo(() => {
    if (typeof currentUserId === "number") return currentUserId;
    if (typeof tokenUserId === "number") return tokenUserId;
    return inferUserIdFromUsers(users, tokenPayload);
  }, [currentUserId, tokenPayload, tokenUserId, users]);

  const { data: conversations = [], isLoading } = useConversations(effectiveCurrentUserId);
  const createConversationMutation = useCreateConversation(effectiveCurrentUserId);
  const createDirectMutation = useCreateDirectConversation(effectiveCurrentUserId);

  const [selectedConversationId, setSelectedConversationId] = useState<number | undefined>();
  const [mobileTab, setMobileTab] = useState<MobileChatTab>("conversations");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const requestedConversationId = useMemo(() => {
    const rawConversationId = searchParams.get("conversationId");
    if (!rawConversationId) return undefined;
    const parsed = Number(rawConversationId);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [searchParams]);

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

  useEffect(() => {
    if (typeof effectiveCurrentUserId !== "number") return;
    if (getUserId() === effectiveCurrentUserId) return;
    setUserId(effectiveCurrentUserId);
  }, [effectiveCurrentUserId]);

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConversationId(undefined);
      return;
    }

    if (typeof selectedConversationId === "number") {
      const isSelectedStillValid = conversations.some((item) => item.id === selectedConversationId);
      if (!isSelectedStillValid) {
        setSelectedConversationId(undefined);
        syncConversationSearchParam(undefined);
      }
      return;
    }

    if (!isMobile) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, isMobile, selectedConversationId, searchParams]);

  useEffect(() => {
    if (typeof requestedConversationId !== "number") return;
    setSelectedConversationId((prev) => (
      prev === requestedConversationId ? prev : requestedConversationId
    ));
    setMobileTab("conversations");
  }, [requestedConversationId]);

  const selectableUsers = useMemo(
    () => users.filter((chatUser) => chatUser.userId !== effectiveCurrentUserId),
    [effectiveCurrentUserId, users],
  );

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  const userDisplayNames = useMemo(() => {
    return users.reduce<Record<number, string>>((acc, chatUser) => {
      const label = chatUser.name || chatUser.username;
      if (label) acc[chatUser.userId] = label;
      return acc;
    }, {});
  }, [users]);

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
      alert("초대할 사용자를 1명 이상 선택해주세요.");
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
    } catch (error) {
      console.error(error);
      alert("대화방 생성에 실패했습니다.");
    }
  };

  const handleCreateDirect = async (otherUserId: number) => {
    try {
      const created = await createDirectMutation.mutateAsync(otherUserId);
      setSelectedConversationId(created.id);
      setMobileTab("conversations");
      syncConversationSearchParam(created.id);
    } catch (error) {
      console.error(error);
      alert("1:1 대화방 생성에 실패했습니다.");
    }
  };

  const handleSelectConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setMobileTab("conversations");
    syncConversationSearchParam(conversationId);
  };

  const handleBackToConversationList = () => {
    setSelectedConversationId(undefined);
    setMobileTab("conversations");
    syncConversationSearchParam(undefined);
  };

  const isMobileConversationOpen = isMobile && typeof selectedConversationId === "number";
  const pageContainerClassName = isMobileConversationOpen
    ? "route-enter h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] overflow-hidden"
    : isMobile
      ? "route-enter space-y-3"
      : "route-enter space-y-4 sm:space-y-5";

  return (
    <div className={pageContainerClassName}>
      {isMobile ? (
        isMobileConversationOpen ? (
          <ChatRoom
            conversationId={selectedConversationId}
            currentUserId={effectiveCurrentUserId}
            conversationTitle={selectedConversation?.title || `대화방 #${selectedConversationId}`}
            userDisplayNames={userDisplayNames}
            onBack={handleBackToConversationList}
            className="h-full min-h-0"
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Messenger</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">
                      {mobileTab === "conversations" ? "채팅" : "빠른 1:1"}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                      {mobileTab === "conversations"
                        ? "카카오톡처럼 대화 목록에서 방을 선택해 시작하세요."
                        : "유저를 선택하면 바로 1:1 대화방이 열립니다."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="h-9 rounded-xl border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + 그룹
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMobileTab("conversations")}
                    className={[
                      "h-10 rounded-xl text-xs font-semibold transition",
                      mobileTab === "conversations"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    대화 목록
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab("direct")}
                    className={[
                      "h-10 rounded-xl text-xs font-semibold transition",
                      mobileTab === "direct"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    빠른 1:1
                  </button>
                </div>
              </div>
            </div>

            {mobileTab === "conversations" ? (
              <SurfaceCard
                padded="none"
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm"
              >
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  isLoading={isLoading}
                />
              </SurfaceCard>
            ) : (
              <SurfaceCard className="space-y-3 rounded-3xl border border-slate-200 bg-white/95">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">대화 가능한 사용자</p>
                  <span className="text-[11px] font-semibold text-slate-500">{selectableUsers.length}명</span>
                </div>
                <div className="space-y-2">
                  {selectableUsers.length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
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
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div>
                        <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                          {chatUser.name || chatUser.username || `User ${chatUser.userId}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">@{chatUser.username || chatUser.userId}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">대화 시작</span>
                    </button>
                  ))}
                </div>
              </SurfaceCard>
            )}
          </>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">메신저</h1>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  팀 채팅, 1:1 대화, 초대 기반 그룹방을 한 화면에서 관리합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  + 새 그룹 초대
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className={selectedConversationId ? "hidden space-y-4 lg:block" : "space-y-4"}>
              <SurfaceCard className="space-y-3 rounded-2xl border border-slate-200 bg-white/95">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">빠른 1:1 시작</p>
                  <span className="text-[11px] font-semibold text-slate-500">{selectableUsers.length}명</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectableUsers.length === 0 && (
                    <p className="text-xs text-slate-500">대화 가능한 사용자가 없습니다.</p>
                  )}
                  {selectableUsers.map((chatUser) => (
                    <button
                      key={chatUser.userId}
                      type="button"
                      onClick={() => {
                        void handleCreateDirect(chatUser.userId);
                      }}
                      className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                        {chatUser.name || chatUser.username || `User ${chatUser.userId}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">@{chatUser.username || chatUser.userId}</p>
                    </button>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard
                padded="none"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm"
              >
                <ConversationList
                  conversations={conversations}
                  selectedConversationId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  isLoading={isLoading}
                />
              </SurfaceCard>
            </div>

            <div className={selectedConversationId ? "block" : "hidden lg:block"}>
              {selectedConversationId ? (
                <ChatRoom
                  conversationId={selectedConversationId}
                  currentUserId={effectiveCurrentUserId}
                  conversationTitle={selectedConversation?.title || `대화방 #${selectedConversationId}`}
                  userDisplayNames={userDisplayNames}
                  onBack={handleBackToConversationList}
                />
              ) : (
                <SurfaceCard className="flex h-[72vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                  왼쪽에서 대화방을 선택하거나 새 그룹을 만들어주세요.
                </SurfaceCard>
              )}
            </div>
          </div>
        </>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-base font-black text-slate-900">새 그룹 채팅 만들기</p>
                <p className="mt-1 text-xs text-slate-500">멤버를 선택해서 바로 초대할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={resetCreateState}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
                placeholder="이름/username/userId 검색"
              />
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {filteredUsers.length === 0 && (
                  <p className="p-2 text-xs text-slate-500">검색 결과가 없습니다.</p>
                )}
                {filteredUsers.map((chatUser) => {
                  const selected = selectedParticipantIds.includes(chatUser.userId);
                  return (
                    <button
                      key={chatUser.userId}
                      type="button"
                      onClick={() => toggleParticipant(chatUser.userId)}
                      className={[
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                        selected
                          ? "border-blue-300 bg-blue-50 text-blue-900"
                          : "border-transparent bg-white text-slate-700 hover:border-slate-200",
                      ].join(" ")}
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {chatUser.name || chatUser.username || `User ${chatUser.userId}`}
                        </p>
                        <p className="text-[11px] text-slate-500">@{chatUser.username || chatUser.userId}</p>
                      </div>
                      <span className="text-xs font-bold">{selected ? "선택됨" : "선택"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
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
        </div>
      )}
    </div>
  );
}
