import { API_BASE_URL, api } from "@/shared/lib/api";
import {
  CHAT_MEMBERSHIP_STATE,
  CHAT_SOCKET_EVENT_RAW,
  CHAT_SOCKET_EVENT_TYPE,
  CHAT_THREAD_TYPE,
  FRIEND_RELATION_STATUS,
  GROUP_INVITE_STATUS,
  type ChatMembershipState,
  type ChatSocketEventType,
  type ChatThreadType,
  type FriendRequestDirection,
  type GroupInviteStatus,
} from "./chat.enums";
import type {
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatUserEvent,
  ChatUserSummary,
  ConversationUnreadCountEvent,
  CreateConversationRequest,
  CreateGroupInviteRequest,
  Friend,
  FriendRequest,
  GroupInvite,
} from "./types";

export type ChatConversation = ChatThread;
export type ChatUser = ChatUserSummary;
export type {
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  CreateConversationRequest,
  CreateGroupInviteRequest,
  Friend,
  FriendRequest,
  GroupInvite,
};

const BASE = API_BASE_URL;

function withUserHeader(userId?: number) {
  return userId ? { "X-User-Id": String(userId) } : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.body === "string") return obj.body;
    if (typeof obj.message === "string") return obj.message;
  }
  return "";
}

function trimText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toText(item).trim())
    .filter((item): item is string => item.length > 0);
}

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toFiniteNumber(item))
    .filter((item): item is number => typeof item === "number");
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeParticipantList(value: unknown): {
  participantUserIds: number[];
  participantNames: string[];
} {
  if (!Array.isArray(value)) {
    return {
      participantUserIds: [],
      participantNames: [],
    };
  }

  const participantUserIds: number[] = [];
  const participantNames: string[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      const primitiveUserId = toFiniteNumber(item);
      if (typeof primitiveUserId === "number") participantUserIds.push(primitiveUserId);
      continue;
    }

    const obj = item as Record<string, unknown>;
    const nestedUser =
      obj.user && typeof obj.user === "object"
        ? (obj.user as Record<string, unknown>)
        : undefined;

    const participantUserId =
      toFiniteNumber(obj.userId) ??
      toFiniteNumber(obj.id) ??
      toFiniteNumber(obj.memberId) ??
      toFiniteNumber(obj.participantUserId) ??
      toFiniteNumber(obj.participant_id) ??
      toFiniteNumber(nestedUser?.userId) ??
      toFiniteNumber(nestedUser?.id);

    if (typeof participantUserId === "number") participantUserIds.push(participantUserId);

    const participantName = (
      toText(obj.nickname) ||
      toText(obj.displayName) ||
      toText(obj.name) ||
      toText(nestedUser?.nickname) ||
      toText(nestedUser?.displayName) ||
      toText(nestedUser?.name)
    ).trim();

    if (participantName) participantNames.push(participantName);
  }

  return {
    participantUserIds,
    participantNames,
  };
}

function normalizeConversationLastMessage(obj: Record<string, unknown>): string {
  const lastMessageObj =
    (obj.lastMessage && typeof obj.lastMessage === "object"
      ? (obj.lastMessage as Record<string, unknown>)
      : undefined) ??
    (obj.lastMessageDto && typeof obj.lastMessageDto === "object"
      ? (obj.lastMessageDto as Record<string, unknown>)
      : undefined);

  const metadata =
    lastMessageObj?.metadata && typeof lastMessageObj.metadata === "object"
      ? (lastMessageObj.metadata as Record<string, unknown>)
      : undefined;

  return (
    toText(obj.lastMessage) ||
    toText(obj.lastMessageContent) ||
    toText(obj.last_message) ||
    toText(obj.last_message_content) ||
    toText(lastMessageObj?.content) ||
    toText(lastMessageObj?.body) ||
    toText(lastMessageObj?.message) ||
    toText(lastMessageObj?.text) ||
    toText(metadata?.content) ||
    toText(metadata?.body) ||
    toText(metadata?.message) ||
    toText(metadata?.text) ||
    ""
  );
}

function normalizeThreadType(value: unknown): ChatThreadType {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return raw === CHAT_THREAD_TYPE.GROUP
    ? CHAT_THREAD_TYPE.GROUP
    : CHAT_THREAD_TYPE.DIRECT;
}

function normalizeMembershipState(value: unknown): ChatMembershipState | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  if (normalized === CHAT_MEMBERSHIP_STATE.ACTIVE) {
    return CHAT_MEMBERSHIP_STATE.ACTIVE;
  }
  if (normalized === CHAT_MEMBERSHIP_STATE.HIDDEN) {
    return CHAT_MEMBERSHIP_STATE.HIDDEN;
  }
  if (normalized === CHAT_MEMBERSHIP_STATE.CLEARED) {
    return CHAT_MEMBERSHIP_STATE.CLEARED;
  }

  return undefined;
}

function normalizeFriendStatus(value: unknown) {
  if (typeof value !== "string") return FRIEND_RELATION_STATUS.ACCEPTED;
  const normalized = value.trim().toUpperCase();

  if (normalized === FRIEND_RELATION_STATUS.PENDING) {
    return FRIEND_RELATION_STATUS.PENDING;
  }
  if (normalized === FRIEND_RELATION_STATUS.ACCEPTED) {
    return FRIEND_RELATION_STATUS.ACCEPTED;
  }
  if (normalized === FRIEND_RELATION_STATUS.REJECTED) {
    return FRIEND_RELATION_STATUS.REJECTED;
  }
  if (normalized === FRIEND_RELATION_STATUS.BLOCKED) {
    return FRIEND_RELATION_STATUS.BLOCKED;
  }
  if (normalized === FRIEND_RELATION_STATUS.CANCELED) {
    return FRIEND_RELATION_STATUS.CANCELED;
  }

  return FRIEND_RELATION_STATUS.ACCEPTED;
}

function normalizeInviteStatus(value: unknown): GroupInviteStatus {
  if (typeof value !== "string") return GROUP_INVITE_STATUS.PENDING;
  const normalized = value.trim().toUpperCase();

  if (normalized === GROUP_INVITE_STATUS.ACCEPTED) {
    return GROUP_INVITE_STATUS.ACCEPTED;
  }
  if (normalized === GROUP_INVITE_STATUS.REJECTED) {
    return GROUP_INVITE_STATUS.REJECTED;
  }

  return GROUP_INVITE_STATUS.PENDING;
}

function normalizeUser(raw: unknown): ChatUserSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nestedUser =
    obj.user && typeof obj.user === "object"
      ? (obj.user as Record<string, unknown>)
      : undefined;

  const userId =
    toFiniteNumber(obj.userId) ??
    toFiniteNumber(obj.friendUserId) ??
    toFiniteNumber(obj.targetUserId) ??
    toFiniteNumber(obj.id) ??
    toFiniteNumber(nestedUser?.userId) ??
    toFiniteNumber(nestedUser?.id);

  if (typeof userId !== "number") return null;

  return {
    userId,
    username:
      trimText(toText(obj.username)) || trimText(toText(nestedUser?.username)),
    name: trimText(toText(obj.name)) || trimText(toText(nestedUser?.name)),
    nickname:
      trimText(toText(obj.nickname)) ||
      trimText(toText(obj.displayName)) ||
      trimText(toText(nestedUser?.nickname)) ||
      trimText(toText(nestedUser?.displayName)),
    avatarUrl:
      trimText(toText(obj.avatarUrl)) ||
      trimText(toText(obj.avatar_url)) ||
      trimText(toText(obj.profileImageUrl)) ||
      trimText(toText(obj.profile_image_url)) ||
      trimText(toText(obj.imageUrl)) ||
      trimText(toText(nestedUser?.avatarUrl)) ||
      trimText(toText(nestedUser?.avatar_url)) ||
      trimText(toText(nestedUser?.profileImageUrl)) ||
      trimText(toText(nestedUser?.profile_image_url)),
  };
}

function normalizeThread(raw: unknown, fallbackType?: ChatThreadType): ChatThread | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawId = obj.id ?? obj.threadId ?? obj.conversationId;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : NaN;

  if (!Number.isFinite(id)) return null;

  const participantUserIdsFromFlat = [
    ...normalizeNumberArray(obj.participantUserIds),
    ...normalizeNumberArray(obj.participant_user_ids),
  ];

  const participantNamesFromFlat = [
    ...normalizeStringArray(obj.participantNames),
    ...normalizeStringArray(obj.participant_names),
  ];

  const participantListFromParticipants = normalizeParticipantList(obj.participants);
  const participantListFromMembers = normalizeParticipantList(obj.members);
  const participantListFromUsers = normalizeParticipantList(obj.users);

  const participantUserIds = uniqueNumbers([
    ...participantUserIdsFromFlat,
    ...participantListFromParticipants.participantUserIds,
    ...participantListFromMembers.participantUserIds,
    ...participantListFromUsers.participantUserIds,
  ]);

  const participantNames = uniqueStrings([
    ...participantNamesFromFlat,
    ...participantListFromParticipants.participantNames,
    ...participantListFromMembers.participantNames,
    ...participantListFromUsers.participantNames,
  ]);

  const rawType =
    obj.type ??
    obj.threadType ??
    obj.conversationType ??
    obj.roomType ??
    obj.chatType;
  const type = fallbackType ?? normalizeThreadType(rawType);

  const participantCount =
    toFiniteNumber(obj.participantCount) ??
    toFiniteNumber(obj.memberCount) ??
    toFiniteNumber(obj.userCount) ??
    toFiniteNumber(obj.participantsCount) ??
    toFiniteNumber(obj.participant_count) ??
    toFiniteNumber(obj.member_count) ??
    toFiniteNumber(obj.user_count) ??
    toFiniteNumber(obj.participants_count) ??
    (participantUserIds.length > 0 ? participantUserIds.length : undefined) ??
    (participantNames.length > 0 ? participantNames.length : undefined);

  const unreadMessageCount =
    toFiniteNumber(obj.unreadMessageCount) ??
    toFiniteNumber(obj.unread_message_count) ??
    toFiniteNumber(obj.unreadCount) ??
    toFiniteNumber(obj.unread_count) ??
    0;

  const normalizedTitle = trimText(
    toText(obj.title) || toText(obj.conversationName) || toText(obj.name),
  );
  const normalizedDisplayTitle = trimText(
    toText(obj.displayTitle) || toText(obj.display_title),
  );

  const membershipState = normalizeMembershipState(
    obj.membershipState ?? obj.membership_status,
  );

  const explicitHidden =
    typeof obj.hidden === "boolean"
      ? obj.hidden
      : typeof obj.isHidden === "boolean"
        ? obj.isHidden
        : typeof obj.hiddenForMe === "boolean"
          ? obj.hiddenForMe
          : undefined;

  const hidden =
    typeof explicitHidden === "boolean"
      ? explicitHidden
      : membershipState === CHAT_MEMBERSHIP_STATE.HIDDEN;
  const pinned =
    toBoolean(obj.pinned) ??
    toBoolean(obj.isPinned) ??
    toBoolean(obj.pinnedForMe);
  const muted =
    toBoolean(obj.muted) ??
    toBoolean(obj.isMuted) ??
    toBoolean(obj.mutedForMe);
  const draftMessage = trimText(
    toText(obj.draftMessage) || toText(obj.draft_message),
  );
  const otherUserPresence = trimText(
    toText(obj.otherUserPresence) || toText(obj.other_user_presence),
  );
  const lastReadMessageId =
    toFiniteNumber(obj.lastReadMessageId) ??
    toFiniteNumber(obj.last_read_message_id);

  return {
    id,
    title: normalizedTitle,
    displayTitle: normalizedDisplayTitle || normalizedTitle || "이름 없는 대화방",
    type,
    avatarUrl:
      trimText(toText(obj.avatarUrl)) ||
      trimText(toText(obj.avatar_url)) ||
      trimText(toText(obj.otherUserAvatarUrl)) ||
      trimText(toText(obj.other_user_avatar_url)) ||
      trimText(toText(obj.profileImageUrl)) ||
      trimText(toText(obj.profile_image_url)),
    lastMessage: normalizeConversationLastMessage(obj),
    unreadMessageCount,
    unreadCount: unreadMessageCount,
    updatedAt:
      (obj.updatedAt as string | undefined) ||
      (obj.lastActivityAt as string | undefined) ||
      (obj.lastMessageAt as string | undefined) ||
      (obj.last_activity_at as string | undefined) ||
      (obj.updated_at as string | undefined),
    participantCount,
    participantUserIds: participantUserIds.length > 0 ? participantUserIds : undefined,
    participantNames: participantNames.length > 0 ? participantNames : undefined,
    membershipState,
    hidden,
    pinned,
    muted,
    draftMessage,
    otherUserPresence,
    lastReadMessageId,
    groupId:
      toFiniteNumber(obj.groupId) ??
      toFiniteNumber(obj.roomId) ??
      toFiniteNumber(obj.group_id) ??
      (type === CHAT_THREAD_TYPE.GROUP ? id : undefined),
  };
}

function normalizeFriend(raw: unknown): Friend | null {
  const user = normalizeUser(raw);
  if (!user) return null;

  const obj = raw as Record<string, unknown>;
  return {
    ...user,
    status: normalizeFriendStatus(obj.status ?? obj.friendStatus),
    createdAt:
      (obj.createdAt as string | undefined) ||
      (obj.requestedAt as string | undefined) ||
      (obj.updatedAt as string | undefined),
  };
}

function normalizeFriendRequest(
  raw: unknown,
  direction: FriendRequestDirection,
): FriendRequest | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const requestId =
    toFiniteNumber(obj.requestId) ??
    toFiniteNumber(obj.id) ??
    toFiniteNumber(obj.friendRequestId);

  if (typeof requestId !== "number") return null;

  const requesterBase =
    (obj.requester && typeof obj.requester === "object"
      ? (obj.requester as Record<string, unknown>)
      : undefined) ||
    (obj.fromUser && typeof obj.fromUser === "object"
      ? (obj.fromUser as Record<string, unknown>)
      : undefined) ||
    obj;

  const requesterCandidate: Record<string, unknown> = {
    ...requesterBase,
    userId:
      requesterBase.userId ??
      requesterBase.id ??
      obj.requesterUserId ??
      obj.fromUserId ??
      obj.userId,
    username:
      requesterBase.username ??
      obj.requesterUsername ??
      obj.fromUsername ??
      obj.username,
    name: requesterBase.name ?? obj.requesterName ?? obj.fromName ?? obj.name,
    nickname:
      requesterBase.nickname ??
      requesterBase.displayName ??
      obj.requesterNickname ??
      obj.fromNickname ??
      obj.requesterDisplayName ??
      obj.fromDisplayName ??
      obj.nickname,
    displayName:
      requesterBase.displayName ??
      requesterBase.nickname ??
      obj.requesterDisplayName ??
      obj.fromDisplayName ??
      obj.requesterNickname ??
      obj.fromNickname,
    avatarUrl:
      requesterBase.avatarUrl ??
      requesterBase.profileImageUrl ??
      obj.requesterAvatarUrl ??
      obj.requesterProfileImageUrl ??
      obj.fromAvatarUrl ??
      obj.fromProfileImageUrl,
  };

  const targetBase =
    (obj.target && typeof obj.target === "object"
      ? (obj.target as Record<string, unknown>)
      : undefined) ||
    (obj.toUser && typeof obj.toUser === "object"
      ? (obj.toUser as Record<string, unknown>)
      : undefined) ||
    obj;

  const targetCandidate: Record<string, unknown> = {
    ...targetBase,
    userId:
      targetBase.userId ??
      targetBase.id ??
      obj.targetUserId ??
      obj.toUserId ??
      obj.friendUserId,
    username:
      targetBase.username ??
      obj.targetUsername ??
      obj.toUsername ??
      obj.friendUsername ??
      obj.username,
    name:
      targetBase.name ?? obj.targetName ?? obj.toName ?? obj.friendName ?? obj.name,
    nickname:
      targetBase.nickname ??
      targetBase.displayName ??
      obj.targetNickname ??
      obj.toNickname ??
      obj.friendNickname ??
      obj.targetDisplayName ??
      obj.toDisplayName ??
      obj.friendDisplayName ??
      obj.nickname,
    displayName:
      targetBase.displayName ??
      targetBase.nickname ??
      obj.targetDisplayName ??
      obj.toDisplayName ??
      obj.friendDisplayName ??
      obj.targetNickname ??
      obj.toNickname ??
      obj.friendNickname,
    avatarUrl:
      targetBase.avatarUrl ??
      targetBase.profileImageUrl ??
      obj.targetAvatarUrl ??
      obj.targetProfileImageUrl ??
      obj.toAvatarUrl ??
      obj.toProfileImageUrl ??
      obj.friendAvatarUrl ??
      obj.friendProfileImageUrl,
  };

  const requester = normalizeUser(requesterCandidate);
  const target = normalizeUser(targetCandidate);

  if (!requester || !target) return null;

  return {
    requestId,
    direction,
    status: normalizeFriendStatus(obj.status ?? obj.requestStatus),
    requester,
    target,
    createdAt: (obj.createdAt as string | undefined) || (obj.requestedAt as string | undefined),
    updatedAt: (obj.updatedAt as string | undefined),
  };
}

function normalizeGroupInvite(raw: unknown): GroupInvite | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const inviteId =
    toFiniteNumber(obj.inviteId) ??
    toFiniteNumber(obj.id) ??
    toFiniteNumber(obj.groupInviteId);

  const groupId =
    toFiniteNumber(obj.groupId) ??
    toFiniteNumber(obj.roomId) ??
    toFiniteNumber(obj.threadId);

  if (typeof inviteId !== "number" || typeof groupId !== "number") return null;

  const inviter =
    normalizeUser(obj.inviter) ||
    normalizeUser(obj.sender) ||
    normalizeUser({
      userId: toFiniteNumber(obj.inviterUserId) ?? toFiniteNumber(obj.senderId),
      username: obj.inviterUsername ?? obj.senderUsername,
      name: obj.inviterName ?? obj.senderName,
      avatarUrl:
        obj.inviterAvatarUrl ??
        obj.inviterProfileImageUrl ??
        obj.senderAvatarUrl ??
        obj.senderProfileImageUrl,
    });

  if (!inviter) return null;

  return {
    inviteId,
    groupId,
    threadId: toFiniteNumber(obj.threadId),
    groupName:
      trimText(toText(obj.groupName)) || trimText(toText(obj.threadTitle)),
    inviter,
    status: normalizeInviteStatus(obj.status),
    createdAt: (obj.createdAt as string | undefined),
    updatedAt: (obj.updatedAt as string | undefined),
  };
}

function normalizeMessage(conversationId: number, raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const sender =
    obj.sender && typeof obj.sender === "object"
      ? (obj.sender as Record<string, unknown>)
      : undefined;

  const metadata =
    obj.metadata && typeof obj.metadata === "object"
      ? (obj.metadata as Record<string, unknown>)
      : undefined;

  const content =
    toText(obj.content) ||
    toText(obj.body) ||
    toText(obj.message) ||
    toText(metadata?.content) ||
    toText(metadata?.body) ||
    toText(metadata?.text) ||
    toText(metadata?.message);

  if (!content) return null;

  const rawId = obj.id ?? obj.messageId;
  const messageId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : undefined;

  return {
    id: Number.isFinite(messageId as number) ? messageId : undefined,
    conversationId: toFiniteNumber(obj.conversationId) ?? conversationId,
    senderId:
      toFiniteNumber(obj.senderId) ??
      toFiniteNumber(obj.userId) ??
      toFiniteNumber(sender?.userId) ??
      toFiniteNumber(sender?.id),
    senderName:
      (obj.nickname as string | undefined) ||
      (obj.displayName as string | undefined) ||
      (obj.senderName as string | undefined) ||
      (obj.sender_name as string | undefined) ||
      (obj.senderNickname as string | undefined) ||
      (obj.sender_nickname as string | undefined) ||
      (obj.name as string | undefined) ||
      (sender?.nickname as string | undefined) ||
      (sender?.name as string | undefined),
    senderAvatarUrl:
      (obj.senderAvatarUrl as string | undefined) ||
      (obj.sender_avatar_url as string | undefined) ||
      (obj.avatarUrl as string | undefined) ||
      (obj.avatar_url as string | undefined) ||
      (obj.profileImageUrl as string | undefined) ||
      (obj.profile_image_url as string | undefined) ||
      (sender?.avatarUrl as string | undefined) ||
      (sender?.avatar_url as string | undefined) ||
      (sender?.profileImageUrl as string | undefined) ||
      (sender?.profile_image_url as string | undefined),
    content,
    createdAt:
      (obj.createdAt as string | undefined) ||
      (obj.sentAt as string | undefined) ||
      (obj.created_at as string | undefined) ||
      (obj.sent_at as string | undefined),
    clientMsgId:
      (typeof obj.clientMsgId === "string" && obj.clientMsgId) ||
      (typeof obj.client_msg_id === "string" && obj.client_msg_id) ||
      undefined,
  };
}

function normalizeEventType(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function mapEventType(rawType: string): ChatSocketEventType | undefined {
  const normalized = rawType.trim().toLowerCase();

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.CHAT_MESSAGE_CREATED ||
    normalized === "message_created"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.MESSAGE_CREATED;
  }

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.CHAT_THREAD_UPDATED ||
    normalized === "thread_updated"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.THREAD_UPDATED;
  }

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.FRIEND_REQUEST_CREATED ||
    normalized === "friend_request_received"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_RECEIVED;
  }

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.FRIEND_REQUEST_UPDATED ||
    normalized === "friend_request_updated"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_UPDATED;
  }

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.GROUP_INVITE_CREATED ||
    normalized === "group_invite_received"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.GROUP_INVITE_RECEIVED;
  }

  if (
    normalized === CHAT_SOCKET_EVENT_RAW.GROUP_INVITE_UPDATED ||
    normalized === "group_invite_updated"
  ) {
    return CHAT_SOCKET_EVENT_TYPE.GROUP_INVITE_UPDATED;
  }

  return undefined;
}

function normalizeCollection(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.content)) return obj.content;
  if (Array.isArray(obj.data)) return obj.data;
  return [];
}

export async function getFriends(userId?: number): Promise<Friend[]> {
  const data = await api<unknown>(`${BASE}/friends`, {
    headers: withUserHeader(userId),
  });

  return normalizeCollection(data)
    .map((item) => normalizeFriend(item))
    .filter((item): item is Friend => Boolean(item));
}

export async function getFriendRequests(
  direction: FriendRequestDirection,
  userId?: number,
): Promise<FriendRequest[]> {
  const qs = new URLSearchParams({ type: direction });
  const data = await api<unknown>(`${BASE}/friends/requests?${qs.toString()}`, {
    headers: withUserHeader(userId),
  });

  return normalizeCollection(data)
    .map((item) => normalizeFriendRequest(item, direction))
    .filter((item): item is FriendRequest => Boolean(item));
}

export async function createFriendRequest(targetUserId: number, userId?: number) {
  await api<void>(`${BASE}/friends/requests`, {
    method: "POST",
    headers: withUserHeader(userId),
    data: { targetUserId },
  });
}

export async function acceptFriendRequest(requestId: number, userId?: number) {
  await api<void>(`${BASE}/friends/requests/${requestId}/accept`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function rejectFriendRequest(requestId: number, userId?: number) {
  await api<void>(`${BASE}/friends/requests/${requestId}/reject`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function cancelFriendRequest(requestId: number, userId?: number) {
  await api<void>(`${BASE}/friends/requests/${requestId}`, {
    method: "DELETE",
    headers: withUserHeader(userId),
    suppressForbiddenRedirect: true,
  });
}

export async function removeFriend(friendUserId: number, userId?: number) {
  await api<void>(`${BASE}/friends/${friendUserId}`, {
    method: "DELETE",
    headers: withUserHeader(userId),
  });
}

export async function blockUser(targetUserId: number, userId?: number) {
  await api<void>(`${BASE}/friends/${targetUserId}/block`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function getChatThreads(
  type: ChatThreadType,
  userId?: number,
): Promise<ChatThread[]> {
  const qs = new URLSearchParams({ type });

  try {
    const data = await api<unknown>(`${BASE}/chats/threads?${qs.toString()}`, {
      headers: withUserHeader(userId),
    });

    return normalizeCollection(data)
      .map((item) => normalizeThread(item, type))
      .filter((item): item is ChatThread => Boolean(item));
  } catch {
    const legacy = await api<unknown>(`${BASE}/chat/conversations`, {
      headers: withUserHeader(userId),
    });

    return normalizeCollection(legacy)
      .map((item) => normalizeThread(item))
      .filter((item): item is ChatThread => Boolean(item))
      .filter((item) => item.type === type);
  }
}

export async function hideChatThread(threadId: number, userId?: number) {
  await api<void>(`${BASE}/chats/threads/${threadId}/hide`, {
    method: "PATCH",
    headers: withUserHeader(userId),
  });
}

export async function unhideChatThread(threadId: number, userId?: number) {
  await api<void>(`${BASE}/chats/threads/${threadId}/unhide`, {
    method: "PATCH",
    headers: withUserHeader(userId),
  });
}

export async function clearMyThreadMessages(threadId: number, userId?: number) {
  await api<void>(`${BASE}/chats/threads/${threadId}/messages/me`, {
    method: "DELETE",
    headers: withUserHeader(userId),
  });
}

export async function createDirectConversation(friendUserId: number, userId?: number) {
  try {
    const data = await api<unknown>(`${BASE}/chats/direct/start`, {
      method: "POST",
      headers: withUserHeader(userId),
      data: { friendUserId },
    });

    const normalized = normalizeThread(data, CHAT_THREAD_TYPE.DIRECT);
    if (!normalized) {
      throw new Error("1:1 대화방 생성 응답 형식이 올바르지 않습니다.");
    }
    return normalized;
  } catch {
    const legacy = await api<unknown>(
      `${BASE}/chat/conversations/direct/${friendUserId}`,
      {
        method: "POST",
        headers: withUserHeader(userId),
      },
    );

    const normalized = normalizeThread(legacy, CHAT_THREAD_TYPE.DIRECT);
    if (!normalized) {
      throw new Error("1:1 대화방 생성 응답 형식이 올바르지 않습니다.");
    }
    return normalized;
  }
}

export async function createConversation(
  req: CreateConversationRequest,
  userId?: number,
) {
  try {
    const data = await api<unknown>(`${BASE}/chats/threads`, {
      method: "POST",
      headers: withUserHeader(userId),
      data: req,
    });

    const normalized = normalizeThread(data, CHAT_THREAD_TYPE.GROUP);
    if (!normalized) throw new Error("대화방 생성 응답 형식이 올바르지 않습니다.");
    return normalized;
  } catch {
    const legacy = await api<unknown>(`${BASE}/chat/conversations`, {
      method: "POST",
      headers: withUserHeader(userId),
      data: req,
    });

    const normalized = normalizeThread(legacy, CHAT_THREAD_TYPE.GROUP);
    if (!normalized) throw new Error("대화방 생성 응답 형식이 올바르지 않습니다.");
    return normalized;
  }
}

export async function createGroupInvites(
  req: CreateGroupInviteRequest,
  userId?: number,
) {
  await api<void>(`${BASE}/chats/groups/${req.groupId}/invites`, {
    method: "POST",
    headers: withUserHeader(userId),
    data: {
      targetUserIds: req.targetUserIds,
    },
  });
}

export async function getPendingGroupInvites(userId?: number): Promise<GroupInvite[]> {
  const qs = new URLSearchParams({ status: GROUP_INVITE_STATUS.PENDING });
  const data = await api<unknown>(`${BASE}/chats/invites?${qs.toString()}`, {
    headers: withUserHeader(userId),
  });

  return normalizeCollection(data)
    .map((item) => normalizeGroupInvite(item))
    .filter((item): item is GroupInvite => Boolean(item));
}

export async function acceptGroupInvite(inviteId: number, userId?: number) {
  await api<void>(`${BASE}/chats/invites/${inviteId}/accept`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function rejectGroupInvite(inviteId: number, userId?: number) {
  await api<void>(`${BASE}/chats/invites/${inviteId}/reject`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function leaveGroupChat(groupId: number, userId?: number) {
  await api<void>(`${BASE}/chats/groups/${groupId}/leave`, {
    method: "POST",
    headers: withUserHeader(userId),
  });
}

export async function getChatUsers(userId?: number) {
  const data = await api<unknown>(`${BASE}/chat/users`, {
    headers: withUserHeader(userId),
  });

  return normalizeCollection(data)
    .map((item) => normalizeUser(item))
    .filter((item): item is ChatUser => Boolean(item));
}

export async function getConversationMessages(
  conversationId: number,
  cursorMessageId?: number,
  size = 30,
  userId?: number,
): Promise<ChatMessagesPage> {
  const qs = new URLSearchParams();
  if (cursorMessageId) qs.set("cursorMessageId", String(cursorMessageId));
  qs.set("size", String(size));

  const url = `${BASE}/chat/conversations/${conversationId}/messages?${qs.toString()}`;
  const data = await api<unknown>(url, {
    headers: withUserHeader(userId),
  });

  const parseMessages = (items: unknown[]): ChatMessage[] =>
    items
      .map((item) => normalizeMessage(conversationId, item))
      .filter((message): message is ChatMessage => Boolean(message))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  if (Array.isArray(data)) {
    const messages = parseMessages(data);
    const nextCursorMessageId = messages.length > 0 ? messages[0].id : undefined;
    return {
      messages,
      nextCursorMessageId,
      hasMore: messages.length >= size,
    };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const rawItems =
      (Array.isArray(obj.items) && obj.items) ||
      (Array.isArray(obj.content) && obj.content) ||
      [];

    const messages = parseMessages(rawItems as unknown[]);
    const hasMore =
      typeof obj.hasMore === "boolean"
        ? obj.hasMore
        : typeof obj.last === "boolean"
          ? !obj.last
          : messages.length >= size;

    const nextCursorMessageId =
      typeof obj.nextCursorMessageId === "number"
        ? obj.nextCursorMessageId
        : messages.length > 0
          ? messages[0].id
          : undefined;

    return {
      messages,
      nextCursorMessageId,
      hasMore,
    };
  }

  return { messages: [], hasMore: false };
}

export async function markConversationRead(
  conversationId: number,
  lastReadMessageId?: number,
  userId?: number,
) {
  return api<void>(`${BASE}/chat/conversations/${conversationId}/read`, {
    method: "POST",
    headers: withUserHeader(userId),
    data: {
      lastReadMessageId,
    },
  });
}

export function toChatMessage(conversationId: number, raw: unknown): ChatMessage | null {
  return normalizeMessage(conversationId, raw);
}

export function toConversationUnreadCountEvent(
  raw: unknown,
): ConversationUnreadCountEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const type = normalizeEventType(obj.type);
  if (type !== "CONVERSATION_UNREAD_COUNT_UPDATED") return null;

  const conversationId = toFiniteNumber(obj.conversationId);
  const unreadMessageCount = toFiniteNumber(obj.unreadMessageCount);
  const totalUnreadMessageCount = toFiniteNumber(obj.totalUnreadMessageCount);

  if (
    typeof conversationId !== "number" ||
    typeof unreadMessageCount !== "number" ||
    typeof totalUnreadMessageCount !== "number"
  ) {
    return null;
  }

  return {
    type: "CONVERSATION_UNREAD_COUNT_UPDATED",
    conversationId,
    unreadMessageCount,
    totalUnreadMessageCount,
  };
}

export function toChatUserEvent(raw: unknown): ChatUserEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawType =
    normalizeEventType(obj.type) ||
    normalizeEventType(obj.eventType) ||
    normalizeEventType(obj.event_name);

  if (!rawType) return null;

  const type = mapEventType(rawType);
  if (!type) return null;

  const payloadCandidate =
    (obj.payload && typeof obj.payload === "object"
      ? (obj.payload as Record<string, unknown>)
      : undefined) ||
    (obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : undefined) ||
    obj;

  return {
    type,
    rawType,
    payload: payloadCandidate,
  };
}

export function toThreadFromEventPayload(
  payload: Record<string, unknown>,
): ChatThread | null {
  return normalizeThread(payload);
}

export function toFriendRequestFromEventPayload(
  payload: Record<string, unknown>,
  direction: FriendRequestDirection,
): FriendRequest | null {
  return normalizeFriendRequest(payload, direction);
}

export function toGroupInviteFromEventPayload(
  payload: Record<string, unknown>,
): GroupInvite | null {
  return normalizeGroupInvite(payload);
}
