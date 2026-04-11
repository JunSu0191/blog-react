import { resolveDisplayName } from "@/shared/lib/displayName";
import type { NotificationItem } from "@/features/notifications";
import {
  CHAT_SOCKET_EVENT_TYPE,
  FRIEND_RELATION_STATUS,
  type ChatSocketEventType,
  type FriendRequestDirection,
  type FriendRelationStatus,
} from "./chat.enums";

type EventPayload = Record<string, unknown>;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalizeFriendStatus(value: unknown): FriendRelationStatus | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();

  if (normalized === FRIEND_RELATION_STATUS.PENDING) return FRIEND_RELATION_STATUS.PENDING;
  if (normalized === FRIEND_RELATION_STATUS.ACCEPTED) return FRIEND_RELATION_STATUS.ACCEPTED;
  if (normalized === FRIEND_RELATION_STATUS.REJECTED) return FRIEND_RELATION_STATUS.REJECTED;
  if (normalized === FRIEND_RELATION_STATUS.BLOCKED) return FRIEND_RELATION_STATUS.BLOCKED;
  if (normalized === FRIEND_RELATION_STATUS.CANCELED) return FRIEND_RELATION_STATUS.CANCELED;
  return undefined;
}

function resolveActorName(payload: EventPayload) {
  const actor = payload.actor && typeof payload.actor === "object"
    ? (payload.actor as Record<string, unknown>)
    : undefined;
  const requester = payload.requester && typeof payload.requester === "object"
    ? (payload.requester as Record<string, unknown>)
    : undefined;
  const sender = payload.sender && typeof payload.sender === "object"
    ? (payload.sender as Record<string, unknown>)
    : undefined;
  const source = actor || requester || sender || payload;

  return resolveDisplayName(
    {
      nickname: toText(source.nickname) || toText(source.displayName),
      displayName:
        toText(source.displayName) ||
        toText(source.friendDisplayName) ||
        toText(source.requesterDisplayName),
      name:
        toText(source.name) ||
        toText(source.friendName) ||
        toText(source.requesterName),
      username:
        toText(source.username) ||
        toText(source.friendUsername) ||
        toText(source.requesterUsername),
    },
    "사용자",
  );
}

function resolveRequestId(payload: EventPayload) {
  return (
    toFiniteNumber(payload.requestId) ??
    toFiniteNumber(payload.friendRequestId) ??
    toFiniteNumber(payload.id)
  );
}

function resolveDirection(payload: EventPayload): FriendRequestDirection | undefined {
  const rawDirection = toText(payload.direction) ?? toText(payload.type);
  if (rawDirection === "received" || rawDirection === "sent") {
    return rawDirection;
  }
  return undefined;
}

function buildFriendRequestMessage(
  eventType: ChatSocketEventType,
  payload: EventPayload,
) {
  const actorName = resolveActorName(payload);
  const status =
    normalizeFriendStatus(payload.status) ||
    normalizeFriendStatus(payload.requestStatus);
  const direction = resolveDirection(payload);

  if (eventType === CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_RECEIVED) {
    return {
      title: "친구 요청",
      body: `${actorName}님이 친구 요청을 보냈습니다.`,
    };
  }

  if (eventType !== CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_UPDATED) {
    return null;
  }

  if (status === FRIEND_RELATION_STATUS.ACCEPTED && direction !== "received") {
    return {
      title: "친구 요청 수락",
      body: `${actorName}님이 친구 요청을 수락했습니다.`,
    };
  }

  if (status === FRIEND_RELATION_STATUS.REJECTED && direction !== "received") {
    return {
      title: "친구 요청 거절",
      body: `${actorName}님이 친구 요청을 거절했습니다.`,
    };
  }

  if (status === FRIEND_RELATION_STATUS.CANCELED && direction === "received") {
    return {
      title: "친구 요청 취소",
      body: `${actorName}님이 친구 요청을 취소했습니다.`,
    };
  }

  return null;
}

export function buildFriendRequestNotificationFromEvent(
  eventType: ChatSocketEventType,
  payload: EventPayload,
  notificationId: number,
): NotificationItem | null {
  const message = buildFriendRequestMessage(eventType, payload);
  if (!message) return null;

  const requestId = resolveRequestId(payload);
  const actorName = resolveActorName(payload);
  const type =
    eventType === CHAT_SOCKET_EVENT_TYPE.FRIEND_REQUEST_RECEIVED
      ? "FRIEND_REQUEST_RECEIVED"
      : message.title === "친구 요청 수락"
        ? "FRIEND_REQUEST_ACCEPTED"
        : message.title === "친구 요청 거절"
          ? "FRIEND_REQUEST_REJECTED"
          : "FRIEND_REQUEST_CANCELED";

  return {
    id: notificationId,
    type,
    title: message.title,
    body: message.body,
    createdAt: new Date().toISOString(),
    isRead: false,
    linkUrl: "/chat",
    payload: {
      requestId,
      requesterName: actorName,
      ...payload,
    },
  };
}

export function buildFriendRequestNotificationSignature(
  eventType: ChatSocketEventType,
  payload: EventPayload,
) {
  const requestId = resolveRequestId(payload);
  const status =
    normalizeFriendStatus(payload.status) ||
    normalizeFriendStatus(payload.requestStatus) ||
    "UNKNOWN";
  const actorId =
    toFiniteNumber(payload.requesterUserId) ??
    toFiniteNumber(payload.actorUserId) ??
    toFiniteNumber(payload.userId);

  return [
    "friend-request",
    eventType,
    requestId ?? "no-request-id",
    status,
    actorId ?? "no-actor-id",
  ].join(":");
}
