import type { ChatConversation } from "./api";

export type ConversationDisplayMeta = {
  title: string;
  initial: string;
  isGroup: boolean;
  participantCount?: number;
};

const GROUP_CONVERSATION_TYPES = new Set(["GROUP", "OPEN", "CHANNEL"]);

function trimText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveConversationTitle(conversation: Pick<ChatConversation, "displayTitle" | "title">): string {
  const displayTitle = trimText(conversation.displayTitle);
  const rawTitle = trimText(conversation.title);
  return displayTitle || rawTitle || "이름 없는 대화방";
}

export function resolveConversationDisplayMeta(
  conversation: ChatConversation,
): ConversationDisplayMeta {
  const title = resolveConversationTitle(conversation);
  const type = trimText(conversation.type)?.toUpperCase();
  const isGroup = Boolean(type && GROUP_CONVERSATION_TYPES.has(type));
  const participantCount =
    typeof conversation.participantCount === "number" &&
    Number.isFinite(conversation.participantCount)
      ? Math.max(0, Math.floor(conversation.participantCount))
      : undefined;

  return {
    title,
    initial: title.slice(0, 1) || "?",
    isGroup,
    participantCount,
  };
}

export function matchesConversationSearch(
  conversation: Pick<ChatConversation, "displayTitle" | "title" | "lastMessage">,
  keyword: string,
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  const title = resolveConversationTitle(conversation).toLowerCase();
  const lastMessage = (conversation.lastMessage || "").toLowerCase();
  return title.includes(normalizedKeyword) || lastMessage.includes(normalizedKeyword);
}
