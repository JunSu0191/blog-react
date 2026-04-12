import {
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
import { ActionDialog, Button, UserAvatar } from "@/shared/ui";
import type { ChatRoomBaseProps } from "./useChatRoomController";
import { useChatRoomController } from "./useChatRoomController";

export default function DesktopChatRoom({
  conversationId,
  currentUserId,
  conversationTitle,
  conversationAvatarUrl,
  conversationType,
  userDisplayNames,
  userAvatarUrls,
  onRequestLeaveGroup,
  onRequestHideThread,
  onRequestClearMyMessages,
  onRequestInviteMembers,
  isLeavingGroup = false,
  isHidingThread = false,
  isClearingMyMessages = false,
  className,
}: ChatRoomBaseProps) {
  const {
    listRef,
    composerRef,
    isComposingRef,
    composerValue,
    setComposerValue,
    messages,
    isLoading,
    isFetchingNextPage,
    handleScroll,
    handleSend,
    handleSendFromButton,
    isDirectConversation,
    isGroupConversation,
    conversationMetaLabel,
    noticeDialogProps,
  } = useChatRoomController(
    {
      conversationId,
      currentUserId,
      conversationType,
    },
    { isMobile: false },
  );

  const hasConversationMenu =
    isGroupConversation ||
    Boolean(onRequestHideThread) ||
    Boolean(onRequestClearMyMessages);

  return (
    <div
      className={cn(
        "relative isolate flex h-[calc(100dvh-9.5rem)] min-h-[540px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_38px_-24px_rgba(2,6,23,0.92)] lg:h-[78vh]",
        className,
      )}
    >
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={conversationTitle || "이름 없는 대화방"}
              imageUrl={conversationAvatarUrl}
              alt={`${conversationTitle || "이름 없는 대화방"} 아바타`}
              className="h-9 w-9"
              fallbackClassName="text-xs font-black"
            />
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {conversationTitle || "이름 없는 대화방"}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {conversationMetaLabel}
              </p>
            </div>
          </div>

          {hasConversationMenu ? (
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
          ) : null}
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="h-0 min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/70 px-3 py-3 dark:bg-slate-950/70 sm:px-4"
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
          const senderAvatarUrl =
            message.senderAvatarUrl ||
            (typeof message.senderId === "number"
              ? userAvatarUrls?.[message.senderId]
              : undefined);

          return (
            <div
              key={message.localId}
              className={cn(
                "flex items-end gap-2",
                isMine ? "justify-end" : "justify-start",
              )}
            >
              {!isMine ? (
                <UserAvatar
                  name={senderLabel}
                  imageUrl={senderAvatarUrl}
                  alt={`${senderLabel} 아바타`}
                  className="h-9 w-9"
                  fallbackClassName="text-xs font-black"
                />
              ) : null}
              <div
                className={[
                  "max-w-[92%] rounded-2xl border px-3 py-2 sm:max-w-[78%]",
                  isMine
                    ? "border-blue-200 bg-blue-50/90 shadow-[0_1px_2px_rgba(37,99,235,0.1)] dark:border-blue-700/60 dark:bg-blue-950/35"
                    : "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
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
              {isMine ? (
                <UserAvatar
                  name={senderLabel}
                  imageUrl={senderAvatarUrl}
                  alt={`${senderLabel} 아바타`}
                  className="h-9 w-9"
                  fallbackClassName="text-xs font-black"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/70 sm:p-2.5">
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
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: coarse)").matches
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
              enterKeyHint="send"
              placeholder="메시지를 입력하세요"
              rows={2}
              className="min-h-[46px] max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <Button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleSendFromButton}
              aria-label="메시지 전송"
              className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 p-0 text-white hover:bg-blue-700"
            >
              <SendHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <ActionDialog {...noticeDialogProps} />
    </div>
  );
}
