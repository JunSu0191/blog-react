import { CHAT_MEMBERSHIP_STATE, FRIEND_RELATION_STATUS } from "./chat.enums";
import type { ChatThread, Friend } from "./types";

export const CHAT_LAYOUT_MODE = {
  MOBILE: "MOBILE",
  DESKTOP: "DESKTOP",
} as const;

export type ChatLayoutMode =
  (typeof CHAT_LAYOUT_MODE)[keyof typeof CHAT_LAYOUT_MODE];

function normalizeUnreadCount(raw: number | undefined) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function canStartDirectChat(friends: Friend[], targetUserId: number) {
  return friends.some(
    (friend) =>
      friend.userId === targetUserId &&
      friend.status === FRIEND_RELATION_STATUS.ACCEPTED,
  );
}

export function applyIncomingMessageToThread(
  thread: ChatThread,
  options: {
    threadId: number;
    isActive: boolean;
    messageContent?: string;
    createdAt?: string;
  },
): ChatThread {
  if (thread.id !== options.threadId) return thread;

  const currentUnread = normalizeUnreadCount(
    thread.unreadMessageCount ?? thread.unreadCount,
  );
  const nextUnread = options.isActive ? 0 : currentUnread + 1;

  return {
    ...thread,
    hidden: false,
    membershipState:
      thread.membershipState === CHAT_MEMBERSHIP_STATE.HIDDEN
        ? CHAT_MEMBERSHIP_STATE.ACTIVE
        : thread.membershipState,
    unreadMessageCount: nextUnread,
    unreadCount: nextUnread,
    lastMessage: options.messageContent || thread.lastMessage,
    updatedAt: options.createdAt || thread.updatedAt,
  };
}

export function upsertThreadForInvite(
  current: ChatThread[],
  invitedThread: ChatThread,
) {
  const index = current.findIndex((thread) => thread.id === invitedThread.id);
  if (index < 0) {
    return [invitedThread, ...current];
  }

  const next = [...current];
  next[index] = {
    ...next[index],
    ...invitedThread,
  };
  return next;
}

export function resolveChatLayoutMode(width: number): ChatLayoutMode {
  if (!Number.isFinite(width) || width < 1024) {
    return CHAT_LAYOUT_MODE.MOBILE;
  }
  return CHAT_LAYOUT_MODE.DESKTOP;
}
