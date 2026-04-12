import { UserAvatar } from "@/shared/ui";
import { BellOff, MoreHorizontal, Pin } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { CHAT_THREAD_TYPE } from "../chat.enums";
import type { ChatConversation } from "../api";
import {
  matchesConversationSearch,
  resolveConversationDisplayMeta,
} from "../conversationDisplay";

type ConversationListProps = {
  conversations: ChatConversation[];
  selectedConversationId?: number;
  currentUserId?: number;
  onSelect: (conversationId: number) => void;
  onRequestLeaveGroup?: (threadId: number) => void;
  onRequestHideThread?: (threadId: number) => void;
  onRequestClearMyMessages?: (threadId: number) => void;
  leavingGroupThreadId?: number;
  hidingThreadId?: number;
  clearingThreadId?: number;
  isLoading?: boolean;
  searchKeyword?: string;
  userAvatarUrls?: Record<number, string | undefined>;
  resurfacedThreadIds?: Set<number>;
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatTime(raw?: string) {
  if (!raw) return "";
  const date = new Date(raw);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}

function formatUnreadCount(raw?: number): string {
  const count = Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw as number))
    : 0;
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

function isDirectConversation(conversation: ChatConversation) {
  return (
    typeof conversation.type === "string" &&
    conversation.type.toUpperCase() === CHAT_THREAD_TYPE.DIRECT
  );
}

function isGroupConversation(conversation: ChatConversation) {
  return (
    typeof conversation.type === "string" &&
    conversation.type.toUpperCase() === CHAT_THREAD_TYPE.GROUP
  );
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  currentUserId,
  onSelect,
  onRequestLeaveGroup,
  onRequestHideThread,
  onRequestClearMyMessages,
  leavingGroupThreadId,
  hidingThreadId,
  clearingThreadId,
  isLoading,
  searchKeyword = "",
  userAvatarUrls,
  resurfacedThreadIds,
  emptyTitle = "대화방이 없습니다.",
  emptyDescription = "새 대화를 시작하면 여기에 최근 대화가 정리됩니다.",
}: ConversationListProps) {
  const filteredConversations = conversations.filter((conversation) =>
    matchesConversationSearch(conversation, searchKeyword),
  );

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
        대화방을 불러오는 중...
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    const isSearchResult = Boolean(searchKeyword.trim());
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {isSearchResult ? "검색 결과가 없습니다." : emptyTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {isSearchResult
              ? "다른 제목이나 참여자 이름으로 다시 찾아보세요."
              : emptyDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
      {filteredConversations.map((conversation) => {
        const isActive = conversation.id === selectedConversationId;
        const isLeavingGroup = leavingGroupThreadId === conversation.id;
        const isHiding = hidingThreadId === conversation.id;
        const isClearing = clearingThreadId === conversation.id;
        const hasPendingAction =
          typeof leavingGroupThreadId === "number" ||
          typeof hidingThreadId === "number" ||
          typeof clearingThreadId === "number";

        const displayMeta = resolveConversationDisplayMeta(conversation);
        const unreadCountText = formatUnreadCount(
          conversation.unreadMessageCount ?? conversation.unreadCount,
        );
        const canClearMyMessages = isDirectConversation(conversation);
        const canLeaveGroup = isGroupConversation(conversation);
        const isResurfaced = Boolean(resurfacedThreadIds?.has(conversation.id));
        const hasUnread = Boolean(unreadCountText);
        const previewText =
          conversation.lastMessage?.trim() || "대화를 시작해보세요.";
        const otherParticipantId = isDirectConversation(conversation)
          ? conversation.participantUserIds?.find((userId) => userId !== currentUserId)
          : undefined;
        const avatarUrl =
          conversation.avatarUrl ||
          (typeof otherParticipantId === "number"
            ? userAvatarUrls?.[otherParticipantId]
            : undefined);

        return (
          <ContextMenu key={conversation.id}>
            <ContextMenuTrigger asChild>
              <div
                className={[
                  "flex items-center gap-2 border-l-2 pr-2 transition-colors duration-200",
                  isActive
                    ? "border-l-blue-500 bg-blue-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-blue-950/35 dark:shadow-none"
                    : hasUnread
                      ? "border-l-transparent bg-slate-50/90 dark:bg-slate-900/80"
                      : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="touch-manipulation flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-[transform,background-color] duration-150 ease-out motion-safe:active:translate-y-[1px] motion-safe:active:scale-[0.985]"
                >
                  <UserAvatar
                    name={displayMeta.title}
                    imageUrl={avatarUrl}
                    alt={`${displayMeta.title} 아바타`}
                    className="h-10 w-10"
                    fallbackClassName="text-xs font-black"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="line-clamp-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                          {displayMeta.title}
                        </p>
                        {displayMeta.isGroup &&
                          typeof displayMeta.participantCount === "number" && (
                            <span className="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                              {displayMeta.participantCount}
                            </span>
                          )}
                        {isResurfaced && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300">
                            새 메시지
                          </span>
                        )}
                        {conversation.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Pin className="h-3 w-3" aria-hidden="true" />
                            고정
                          </span>
                        )}
                        {conversation.muted && (
                          <span className="inline-flex items-center justify-center rounded-full bg-slate-200 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <BellOff className="h-3 w-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {previewText}
                      </p>
                      {unreadCountText && (
                        <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {unreadCountText}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {(onRequestLeaveGroup || onRequestHideThread || onRequestClearMyMessages) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                        aria-label="대화방 메뉴"
                        disabled={hasPendingAction}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6} className="w-48">
                      {canLeaveGroup && onRequestLeaveGroup && (
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                          disabled={hasPendingAction}
                          onSelect={(event) => {
                            event.preventDefault();
                            onRequestLeaveGroup(conversation.id);
                          }}
                        >
                          {isLeavingGroup ? "나가는 중..." : "그룹 나가기"}
                        </DropdownMenuItem>
                      )}
                      {onRequestHideThread && (
                        <DropdownMenuItem
                          disabled={hasPendingAction}
                          onSelect={(event) => {
                            event.preventDefault();
                            onRequestHideThread(conversation.id);
                          }}
                        >
                          {isHiding ? "숨기는 중..." : "대화 숨기기"}
                        </DropdownMenuItem>
                      )}
                      {canClearMyMessages && onRequestClearMyMessages && (
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                          disabled={hasPendingAction}
                          onSelect={(event) => {
                            event.preventDefault();
                            onRequestClearMyMessages(conversation.id);
                          }}
                        >
                          {isClearing ? "삭제 중..." : "내 메시지 기록 삭제"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </ContextMenuTrigger>

            {(onRequestLeaveGroup || onRequestHideThread || onRequestClearMyMessages) && (
              <ContextMenuContent className="w-48">
                {canLeaveGroup && onRequestLeaveGroup && (
                  <ContextMenuItem
                    className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                    disabled={hasPendingAction}
                    onSelect={() => onRequestLeaveGroup(conversation.id)}
                  >
                    {isLeavingGroup ? "나가는 중..." : "그룹 나가기"}
                  </ContextMenuItem>
                )}
                {onRequestHideThread && (
                  <ContextMenuItem
                    disabled={hasPendingAction}
                    onSelect={() => onRequestHideThread(conversation.id)}
                  >
                    {isHiding ? "숨기는 중..." : "대화 숨기기"}
                  </ContextMenuItem>
                )}
                {canClearMyMessages && onRequestClearMyMessages && (
                  <ContextMenuItem
                    className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                    disabled={hasPendingAction}
                    onSelect={() => onRequestClearMyMessages(conversation.id)}
                  >
                    {isClearing ? "삭제 중..." : "내 메시지 기록 삭제"}
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            )}
          </ContextMenu>
        );
      })}
    </div>
  );
}
