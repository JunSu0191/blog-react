import type {
  ChatMembershipState,
  ChatSocketEventType,
  ChatThreadType,
  FriendRelationStatus,
  FriendRequestDirection,
  GroupInviteStatus,
} from "./chat.enums";

export type ChatUserSummary = {
  userId: number;
  username?: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
};

export type Friend = ChatUserSummary & {
  status: FriendRelationStatus;
  createdAt?: string;
};

export type FriendRequest = {
  requestId: number;
  direction: FriendRequestDirection;
  status: FriendRelationStatus;
  requester: ChatUserSummary;
  target: ChatUserSummary;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatThread = {
  id: number;
  type: ChatThreadType;
  title?: string | null;
  displayTitle: string;
  avatarUrl?: string;
  lastMessage?: string;
  unreadMessageCount: number;
  // Backward compatibility for existing UI paths.
  unreadCount?: number;
  updatedAt?: string;
  participantCount?: number;
  participantUserIds?: number[];
  participantNames?: string[];
  membershipState?: ChatMembershipState;
  hidden?: boolean;
  pinned?: boolean;
  muted?: boolean;
  draftMessage?: string;
  otherUserPresence?: string;
  lastReadMessageId?: number;
  groupId?: number;
};

export type ChatMessage = {
  id?: number;
  conversationId: number;
  senderId?: number;
  senderName?: string;
  senderAvatarUrl?: string;
  content: string;
  createdAt?: string;
  clientMsgId?: string;
  messageType?: string;
  deliveryStatus?: string;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  nextCursorMessageId?: number;
  hasMore: boolean;
};

export type GroupInvite = {
  inviteId: number;
  groupId: number;
  threadId?: number;
  groupName?: string;
  inviter: ChatUserSummary;
  status: GroupInviteStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatUserEvent = {
  type: ChatSocketEventType;
  rawType: string;
  payload: Record<string, unknown>;
};

export type ConversationUnreadCountEvent = {
  type: "CONVERSATION_UNREAD_COUNT_UPDATED";
  conversationId: number;
  unreadMessageCount: number;
  totalUnreadMessageCount: number;
};

export type CreateConversationRequest = {
  type: "GROUP";
  title?: string;
  participantUserIds: number[];
};

export type CreateGroupInviteRequest = {
  groupId: number;
  targetUserIds: number[];
};
