import { API_BASE_URL, api } from "@/shared/lib/api";

export type ChatConversation = {
  id: number;
  title?: string;
  lastMessage?: string;
  unreadCount?: number;
  updatedAt?: string;
  participantUserIds?: number[];
};

export type ChatUser = {
  userId: number;
  username?: string;
  name?: string;
};

export type ChatMessage = {
  id?: number;
  conversationId: number;
  senderId?: number;
  senderName?: string;
  content: string;
  createdAt?: string;
  clientMsgId?: string;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  nextCursorMessageId?: number;
  hasMore: boolean;
};

export type CreateConversationRequest = {
  type: "GROUP";
  title?: string;
  participantUserIds: number[];
};

const BASE = API_BASE_URL;

function withUserHeader(userId?: number) {
  return userId ? { "X-User-Id": String(userId) } : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.body === "string") return obj.body;
    if (typeof obj.message === "string") return obj.message;
  }
  return "";
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

function normalizeConversation(raw: unknown): ChatConversation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawId = obj.id ?? obj.conversationId;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : NaN;

  if (!Number.isFinite(id)) return null;

  return {
    id,
    title:
      toText(obj.title) ||
      toText(obj.conversationName) ||
      toText(obj.name),
    lastMessage: normalizeConversationLastMessage(obj),
    unreadCount:
      toFiniteNumber(obj.unreadCount) ??
      toFiniteNumber(obj.unread_count) ??
      toFiniteNumber(obj.unreadMessageCount) ??
      toFiniteNumber(obj.unread_message_count) ??
      0,
    updatedAt:
      (obj.updatedAt as string | undefined) ||
      (obj.lastMessageAt as string | undefined) ||
      (obj.updated_at as string | undefined),
    participantUserIds: Array.isArray(obj.participantUserIds)
      ? (obj.participantUserIds as number[])
      : Array.isArray(obj.participant_user_ids)
        ? (obj.participant_user_ids as number[])
        : undefined,
  };
}

function normalizeUser(raw: unknown): ChatUser | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawUserId = obj.userId ?? obj.id;
  const userId =
    typeof rawUserId === "number"
      ? rawUserId
      : typeof rawUserId === "string"
        ? Number(rawUserId)
        : NaN;

  if (!Number.isFinite(userId)) return null;

  return {
    userId,
    username: typeof obj.username === "string" ? obj.username : undefined,
    name: typeof obj.name === "string" ? obj.name : undefined,
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
      (obj.senderName as string | undefined) ||
      (obj.sender_name as string | undefined) ||
      (obj.username as string | undefined) ||
      (obj.name as string | undefined) ||
      (obj.senderUsername as string | undefined) ||
      (obj.sender_username as string | undefined) ||
      (sender?.name as string | undefined) ||
      (sender?.username as string | undefined) ||
      (sender?.nickname as string | undefined),
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

export async function getConversations(userId?: number) {
  const data = await api<unknown>(`${BASE}/chat/conversations`, {
    headers: withUserHeader(userId),
  });

  const rawItems =
    (Array.isArray(data) && data) ||
    (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).content)
      ? ((data as Record<string, unknown>).content as unknown[])
      : []);

  return rawItems
    .map((item) => normalizeConversation(item))
    .filter((item): item is ChatConversation => !!item);
}

export async function getChatUsers(userId?: number) {
  const data = await api<unknown>(`${BASE}/chat/users`, {
    headers: withUserHeader(userId),
  });

  const rawItems =
    (Array.isArray(data) && data) ||
    (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).content)
      ? ((data as Record<string, unknown>).content as unknown[])
      : []);

  return rawItems
    .map((item) => normalizeUser(item))
    .filter((item): item is ChatUser => !!item);
}

export async function createConversation(
  req: CreateConversationRequest,
  userId?: number,
) {
  const data = await api<unknown>(`${BASE}/chat/conversations`, {
    method: "POST",
    headers: withUserHeader(userId),
    data: req,
  });

  const normalized = normalizeConversation(data);
  if (!normalized) throw new Error("대화방 생성 응답 형식이 올바르지 않습니다.");
  return normalized;
}

export async function createDirectConversation(otherUserId: number, userId?: number) {
  const data = await api<unknown>(`${BASE}/chat/conversations/direct/${otherUserId}`, {
    method: "POST",
    headers: withUserHeader(userId),
  });

  const normalized = normalizeConversation(data);
  if (!normalized) throw new Error("1:1 대화방 생성 응답 형식이 올바르지 않습니다.");
  return normalized;
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
      .filter((message): message is ChatMessage => !!message)
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
