import type { ChatConversation } from "../api";

type ConversationListProps = {
  conversations: ChatConversation[];
  selectedConversationId?: number;
  onSelect: (conversationId: number) => void;
  isLoading?: boolean;
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

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return <div className="p-4 text-sm text-slate-500 dark:text-slate-400">대화방을 불러오는 중...</div>;
  }

  if (conversations.length === 0) {
    return <div className="p-4 text-sm text-slate-500 dark:text-slate-400">대화방이 없습니다.</div>;
  }

  return (
    <div className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
      {conversations.map((conversation) => {
        const isActive = conversation.id === selectedConversationId;
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
            className={[
              "w-full px-4 py-3 text-left transition",
              isActive ? "bg-blue-50/80 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {(conversation.title || `#${conversation.id}`).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {conversation.title || `대화방 #${conversation.id}`}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{formatTime(conversation.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {conversation.lastMessage || "최근 메시지가 없습니다."}
                  </p>
                  {(conversation.unreadCount || 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      읽지 않음 {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
