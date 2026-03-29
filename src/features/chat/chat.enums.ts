export const CHAT_THREAD_TYPE = {
  DIRECT: "DIRECT",
  GROUP: "GROUP",
} as const;

export type ChatThreadType =
  (typeof CHAT_THREAD_TYPE)[keyof typeof CHAT_THREAD_TYPE];

export const CHAT_MEMBERSHIP_STATE = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
  CLEARED: "CLEARED",
} as const;

export type ChatMembershipState =
  (typeof CHAT_MEMBERSHIP_STATE)[keyof typeof CHAT_MEMBERSHIP_STATE];

export const FRIEND_REQUEST_DIRECTION = {
  RECEIVED: "received",
  SENT: "sent",
} as const;

export type FriendRequestDirection =
  (typeof FRIEND_REQUEST_DIRECTION)[keyof typeof FRIEND_REQUEST_DIRECTION];

export const FRIEND_RELATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  BLOCKED: "BLOCKED",
  CANCELED: "CANCELED",
} as const;

export type FriendRelationStatus =
  (typeof FRIEND_RELATION_STATUS)[keyof typeof FRIEND_RELATION_STATUS];

export const GROUP_INVITE_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;

export type GroupInviteStatus =
  (typeof GROUP_INVITE_STATUS)[keyof typeof GROUP_INVITE_STATUS];

export const CHAT_SOCKET_EVENT_RAW = {
  CHAT_MESSAGE_CREATED: "chat.message.created",
  CHAT_THREAD_UPDATED: "chat.thread.updated",
  FRIEND_REQUEST_CREATED: "friend.request.created",
  FRIEND_REQUEST_UPDATED: "friend.request.updated",
  GROUP_INVITE_CREATED: "group.invite.created",
  GROUP_INVITE_UPDATED: "group.invite.updated",
} as const;

export type ChatSocketEventRawType =
  (typeof CHAT_SOCKET_EVENT_RAW)[keyof typeof CHAT_SOCKET_EVENT_RAW];

export const CHAT_SOCKET_EVENT_TYPE = {
  MESSAGE_CREATED: "MESSAGE_CREATED",
  THREAD_UPDATED: "THREAD_UPDATED",
  FRIEND_REQUEST_RECEIVED: "FRIEND_REQUEST_RECEIVED",
  FRIEND_REQUEST_UPDATED: "FRIEND_REQUEST_UPDATED",
  GROUP_INVITE_RECEIVED: "GROUP_INVITE_RECEIVED",
  GROUP_INVITE_UPDATED: "GROUP_INVITE_UPDATED",
} as const;

export type ChatSocketEventType =
  (typeof CHAT_SOCKET_EVENT_TYPE)[keyof typeof CHAT_SOCKET_EVENT_TYPE];

