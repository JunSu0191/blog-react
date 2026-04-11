import { useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  EllipsisVertical,
  EyeOff,
  LogOut,
  SendHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ActionDialog, Button } from "@/shared/ui";
import { useChatRoomController, type ChatRoomBaseProps } from "./useChatRoomController";

export default function MobileChatRoom({
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
}: ChatRoomBaseProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
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
    { isMobile: true },
  );

  const hasConversationMenu =
    isGroupConversation ||
    Boolean(onRequestHideThread) ||
    Boolean(onRequestClearMyMessages);

  const handleMobileMenuAction = (action: () => void) => {
    setIsActionMenuOpen(false);
    action();
  };

  const mobileConversationMenu =
    hasConversationMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            className={[
              "fixed inset-0 z-[220]",
              isActionMenuOpen ? "pointer-events-auto" : "pointer-events-none",
            ].join(" ")}
            aria-hidden={!isActionMenuOpen}
          >
            <button
              type="button"
              className={[
                "absolute inset-0 bg-slate-950/45 transition-opacity duration-200",
                isActionMenuOpen ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => setIsActionMenuOpen(false)}
              aria-label="메뉴 닫기"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="대화방 메뉴"
              className={[
                "absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900",
                isActionMenuOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
              <div className="space-y-2">
                {isGroupConversation && onRequestInviteMembers && (
                  <button
                    type="button"
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestInviteMembers(conversationId))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    멤버 초대
                  </button>
                )}
                {onRequestHideThread && (
                  <button
                    type="button"
                    disabled={isHidingThread}
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestHideThread(conversationId))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    {isHidingThread ? "숨기는 중..." : "대화 숨기기"}
                  </button>
                )}
                {isDirectConversation && onRequestClearMyMessages && (
                  <button
                    type="button"
                    disabled={isClearingMyMessages}
                    onClick={() =>
                      handleMobileMenuAction(() =>
                        onRequestClearMyMessages(conversationId),
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/55"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {isClearingMyMessages ? "삭제 중..." : "내 기록 삭제"}
                  </button>
                )}
                {isGroupConversation && onRequestLeaveGroup && (
                  <button
                    type="button"
                    disabled={isLeavingGroup}
                    onClick={() =>
                      handleMobileMenuAction(() => onRequestLeaveGroup(conversationId))
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
                onClick={() => setIsActionMenuOpen(false)}
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
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-white dark:bg-slate-900">
      <div className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-3 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/88 dark:border-slate-700 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/88">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
          {hasConversationMenu ? (
            <button
              type="button"
              onClick={() => setIsActionMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="대화방 메뉴"
            >
              <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-slate-50/70 px-2.5 py-2.5 pb-3 dark:bg-slate-950/70 [touch-action:pan-y]"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
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
                "max-w-[92%] rounded-2xl border px-3 py-2",
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

      <div className="sticky bottom-0 z-30 shrink-0 border-t border-slate-200 bg-white/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.32)] backdrop-blur supports-[backdrop-filter]:bg-white/88 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-[0_-10px_26px_-18px_rgba(2,6,23,0.92)] dark:supports-[backdrop-filter]:bg-slate-900/88">
        <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-800/70">
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
              enterKeyHint="enter"
              placeholder="메시지를 입력하세요"
              rows={1}
              className="min-h-[38px] max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[16px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <Button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleSendFromButton}
              aria-label="메시지 전송"
              className="h-[38px] w-[38px] shrink-0 rounded-xl bg-blue-600 p-0 text-white hover:bg-blue-700"
            >
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <ActionDialog {...noticeDialogProps} />
      {mobileConversationMenu}
    </div>
  );
}
