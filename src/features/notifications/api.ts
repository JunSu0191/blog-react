import { API_BASE_URL, api } from "@/shared/lib/api";

export type NotificationType =
  | "POST_COMMENT"
  | "CHAT_MESSAGE"
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "FRIEND_REQUEST_REJECTED"
  | "FRIEND_REQUEST_CANCELED"
  | string;

export type NotificationPayload = {
  postId?: number;
  commentId?: number;
  commenterId?: number;
  parentCommentId?: number;
  conversationId?: number;
  messageId?: number;
  senderId?: number;
  requestId?: number;
  requesterId?: number;
  requesterName?: string;
  requesterNickname?: string;
  requesterDisplayName?: string;
  targetUserId?: number;
} & Record<string, unknown>;

export type NotificationItem = {
  id: number;
  type?: NotificationType;
  payload?: NotificationPayload;
  title?: string;
  body?: string;
  createdAt?: string;
  readAt?: string | null;
  isRead: boolean;
  linkUrl?: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursorId?: number;
  hasMore: boolean;
};

export type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
};

const BASE = API_BASE_URL;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizePayload(raw: unknown): NotificationPayload | undefined {
  if (raw && typeof raw === "object") {
    return raw as NotificationPayload;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as NotificationPayload;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function buildDefaultLink(type: NotificationType | undefined, payload: NotificationPayload | undefined) {
  if (!type) return undefined;

  if (type === "POST_COMMENT") {
    const postId = toFiniteNumber(payload?.postId);
    if (typeof postId === "number") return `/posts/${postId}`;
    return undefined;
  }

  if (type === "CHAT_MESSAGE") {
    const conversationId = toFiniteNumber(payload?.conversationId);
    if (typeof conversationId === "number") return `/chat?conversationId=${conversationId}`;
    return "/chat";
  }

  if (
    type === "FRIEND_REQUEST_RECEIVED" ||
    type === "FRIEND_REQUEST_ACCEPTED" ||
    type === "FRIEND_REQUEST_REJECTED" ||
    type === "FRIEND_REQUEST_CANCELED"
  ) {
    return "/chat";
  }

  return undefined;
}

export function toNotificationContent(item: NotificationItem) {
  if (item.title || item.body) {
    return {
      title: item.title || item.type || "알림",
      body: item.body || "",
      linkUrl: item.linkUrl,
    };
  }

  if (item.type === "POST_COMMENT") {
    const hasReply = typeof toFiniteNumber(item.payload?.parentCommentId) === "number";
    return {
      title: "새 댓글",
      body: hasReply
        ? "내 댓글에 새로운 답글이 달렸습니다."
        : "게시글에 새로운 댓글이 달렸습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  if (item.type === "CHAT_MESSAGE") {
    return {
      title: "새 채팅 메시지",
      body: "대화방에 새로운 메시지가 도착했습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  if (item.type === "FRIEND_REQUEST_RECEIVED") {
    return {
      title: "친구 요청",
      body:
        item.body ||
        "새 친구 요청이 도착했습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  if (item.type === "FRIEND_REQUEST_ACCEPTED") {
    return {
      title: "친구 요청 수락",
      body:
        item.body ||
        "보낸 친구 요청이 수락되었습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  if (item.type === "FRIEND_REQUEST_REJECTED") {
    return {
      title: "친구 요청 거절",
      body:
        item.body ||
        "보낸 친구 요청이 거절되었습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  if (item.type === "FRIEND_REQUEST_CANCELED") {
    return {
      title: "친구 요청 취소",
      body:
        item.body ||
        "친구 요청이 취소되었습니다.",
      linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
    };
  }

  return {
    title: item.type || "알림",
    body: "",
    linkUrl: item.linkUrl || buildDefaultLink(item.type, item.payload),
  };
}

function normalizeNotification(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawId =
    obj.id ??
    obj.notificationId ??
    obj.notification_id ??
    obj.alarmId ??
    obj.alarm_id;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : NaN;
  if (!Number.isFinite(id)) return null;

  const createdAt =
    (typeof obj.createdAt === "string" && obj.createdAt) ||
    (typeof obj.created_at === "string" && obj.created_at) ||
    undefined;

  const parsedReadAt =
    typeof obj.readAt === "string" || obj.readAt === null
      ? (obj.readAt as string | null)
      : typeof obj.read_at === "string" || obj.read_at === null
        ? (obj.read_at as string | null)
        : null;
  const readFlag =
    typeof obj.read === "boolean"
      ? obj.read
      : typeof obj.isRead === "boolean"
        ? obj.isRead
        : undefined;
  const isRead = Boolean(parsedReadAt) || readFlag === true;

  const type =
    (typeof obj.type === "string" && obj.type) ||
    (typeof obj.notificationType === "string" && obj.notificationType) ||
    undefined;
  const payload =
    normalizePayload(obj.payload) ||
    normalizePayload(obj.notificationPayload) ||
    normalizePayload(obj.meta);
  const linkUrl =
    (typeof obj.linkUrl === "string" && obj.linkUrl) ||
    (typeof obj.link_url === "string" && obj.link_url) ||
    buildDefaultLink(type, payload);

  return {
    id,
    type,
    payload,
    title: typeof obj.title === "string" ? obj.title : undefined,
    body:
      (typeof obj.body === "string" && obj.body) ||
      (typeof obj.message === "string" && obj.message) ||
      undefined,
    createdAt,
    readAt: parsedReadAt,
    isRead,
    linkUrl,
  };
}

export async function getNotifications(cursorId?: number, size = 30): Promise<NotificationPage> {
  const qs = new URLSearchParams();
  if (cursorId) qs.set("cursorId", String(cursorId));
  qs.set("size", String(size));

  const data = await api<unknown>(`${BASE}/notifications?${qs.toString()}`);

  const mapItems = (items: unknown[]): NotificationItem[] =>
    items
      .map((item) => normalizeNotification(item))
      .filter((item): item is NotificationItem => !!item)
      .sort((a, b) => b.id - a.id);

  if (Array.isArray(data)) {
    const items = mapItems(data);
    return {
      items,
      nextCursorId: items.length > 0 ? items[items.length - 1].id : undefined,
      hasMore: items.length >= size,
    };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const rawItems =
      (Array.isArray(obj.items) && obj.items) ||
      (Array.isArray(obj.content) && obj.content) ||
      (Array.isArray(obj.notifications) && obj.notifications) ||
      (Array.isArray(obj.results) && obj.results) ||
      [];

    const items = mapItems(rawItems as unknown[]);
    const hasMore =
      typeof obj.hasMore === "boolean"
        ? obj.hasMore
        : typeof obj.last === "boolean"
          ? !obj.last
          : items.length >= size;

    const nextCursorId =
      typeof obj.nextCursorId === "number"
        ? obj.nextCursorId
        : typeof obj.next_cursor_id === "number"
          ? obj.next_cursor_id
        : items.length > 0
          ? items[items.length - 1].id
          : undefined;

    return { items, hasMore, nextCursorId };
  }

  return { items: [], hasMore: false };
}

export async function readNotification(id: number) {
  return api<void>(`${BASE}/notifications/${id}/read`, {
    method: "POST",
  });
}

export async function readAllNotifications() {
  return api<void>(`${BASE}/notifications/read-all`, {
    method: "POST",
  });
}

export function toNotification(raw: unknown): NotificationItem | null {
  return normalizeNotification(raw);
}

const DEFAULT_SUMMARY_PAGE_SIZE = 200;
const MAX_SUMMARY_PAGE_FETCHES = 50;

export async function getNotificationSummary(
  size = DEFAULT_SUMMARY_PAGE_SIZE,
): Promise<NotificationSummary> {
  const seenIds = new Set<number>();
  let totalCount = 0;
  let unreadCount = 0;
  let cursorId: number | undefined;
  let fetchCount = 0;

  while (fetchCount < MAX_SUMMARY_PAGE_FETCHES) {
    fetchCount += 1;
    const page = await getNotifications(cursorId, size);
    const uniqueItems = page.items.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    totalCount += uniqueItems.length;
    unreadCount += uniqueItems.filter((item) => !item.isRead).length;

    if (!page.hasMore) break;
    if (typeof page.nextCursorId !== "number") break;
    if (page.nextCursorId === cursorId) break;
    cursorId = page.nextCursorId;
  }

  return {
    totalCount,
    unreadCount,
  };
}
