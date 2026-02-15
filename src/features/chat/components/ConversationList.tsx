import { MoreHorizontal } from "lucide-react";
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
import type { ChatConversation } from "../api";
import {
  matchesConversationSearch,
  resolveConversationDisplayMeta,
} from "../conversationDisplay";

type ConversationListProps = {
  conversations: ChatConversation[];
  selectedConversationId?: number;
  onSelect: (conversationId: number) => void;
  onRequestLeaveConversation?: (conversationId: number) => void;
  leavingConversationId?: number;
  isLoading?: boolean;
  searchKeyword?: string;
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

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  onRequestLeaveConversation,
  leavingConversationId,
  isLoading,
  searchKeyword = "",
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
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
        {searchKeyword.trim() ? "검색 결과가 없습니다." : "대화방이 없습니다."}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
      {filteredConversations.map((conversation) => {
        const isActive = conversation.id === selectedConversationId;
        const isLeaving = leavingConversationId === conversation.id;
        const isAnyLeavePending = typeof leavingConversationId === "number";

        const displayMeta = resolveConversationDisplayMeta(conversation);
        const unreadCountText = formatUnreadCount(
          conversation.unreadMessageCount ?? conversation.unreadCount,
        );

        return (
          <ContextMenu key={conversation.id}>
            <ContextMenuTrigger asChild>
              <div
                className={[
                  "flex items-center gap-2 pr-2",
                  isActive
                    ? "bg-blue-50/80 dark:bg-blue-950/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="touch-manipulation flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-[transform,background-color] duration-150 ease-out motion-safe:active:translate-y-[1px] motion-safe:active:scale-[0.985]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {displayMeta.initial}
                  </span>
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
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {conversation.lastMessage || "최근 메시지가 없습니다."}
                      </p>
                      {unreadCountText && (
                        <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {unreadCountText}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {onRequestLeaveConversation && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                        aria-label="대화방 메뉴"
                        disabled={isAnyLeavePending}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                        disabled={isAnyLeavePending}
                        onSelect={(event) => {
                          event.preventDefault();
                          onRequestLeaveConversation(conversation.id);
                        }}
                      >
                        {isLeaving ? "나가는 중..." : "대화방 나가기"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </ContextMenuTrigger>

            {onRequestLeaveConversation && (
              <ContextMenuContent className="w-40">
                <ContextMenuItem
                  className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                  disabled={isAnyLeavePending}
                  onSelect={() => onRequestLeaveConversation(conversation.id)}
                >
                  {isLeaving ? "나가는 중..." : "대화방 나가기"}
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
        );
      })}
    </div>
  );
}
