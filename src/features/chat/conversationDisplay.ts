import type { ChatConversation } from "./api";

export type ConversationDisplayMeta = {
  title: string;
  initial: string;
  isGroup: boolean;
  participantCount?: number;
};

const GROUP_CONVERSATION_TYPES = new Set(["GROUP", "OPEN", "CHANNEL"]);
const UNTITLED_CONVERSATION_TITLES = new Set([
  "이름 없는 대화방",
  "이름 없는 대화",
]);

type ConversationDisplayOptions = {
  currentUserId?: number;
  userDisplayNames?: Record<number, string>;
};

type ConversationDisplaySource = {
  displayTitle?: ChatConversation["displayTitle"];
  title?: ChatConversation["title"];
  participantNames?: ChatConversation["participantNames"];
  participantUserIds?: ChatConversation["participantUserIds"];
  type?: ChatConversation["type"];
};

function trimText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUntitledConversationTitle(title?: string) {
  if (!title) return true;
  return UNTITLED_CONVERSATION_TITLES.has(title);
}

function uniqueTexts(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => trimText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function resolveParticipantLabels(
  conversation: ConversationDisplaySource,
  options: ConversationDisplayOptions = {},
) {
  const participantNames = uniqueTexts(conversation.participantNames || []);
  const mappedNames = uniqueTexts(
    (conversation.participantUserIds || []).map((userId) => options.userDisplayNames?.[userId]),
  );
  const mergedNames = uniqueTexts([...participantNames, ...mappedNames]);
  const isGroupConversation = GROUP_CONVERSATION_TYPES.has(
    trimText(conversation.type)?.toUpperCase() || "",
  );

  if (isGroupConversation) return mergedNames;

  const otherParticipantNames = uniqueTexts(
    (conversation.participantUserIds || [])
      .filter((userId) => userId !== options.currentUserId)
      .map((userId) => options.userDisplayNames?.[userId]),
  );

  return otherParticipantNames.length > 0 ? otherParticipantNames : mergedNames;
}

export function resolveConversationTitle(
  conversation: ConversationDisplaySource,
  options: ConversationDisplayOptions = {},
): string {
  const displayTitle = trimText(conversation.displayTitle);
  const rawTitle = trimText(conversation.title);
  const explicitTitle = displayTitle || rawTitle;

  if (explicitTitle && !isUntitledConversationTitle(explicitTitle)) {
    return explicitTitle;
  }

  const participantLabels = resolveParticipantLabels(conversation, options);
  const isGroupConversation = GROUP_CONVERSATION_TYPES.has(
    trimText(conversation.type)?.toUpperCase() || "",
  );

  if (participantLabels.length > 0) {
    if (!isGroupConversation) return participantLabels[0];
    if (participantLabels.length <= 2) return participantLabels.join(", ");
    return `${participantLabels.slice(0, 2).join(", ")} 외 ${participantLabels.length - 2}명`;
  }

  return explicitTitle || "이름 없는 대화방";
}

export function resolveConversationDisplayMeta(
  conversation: ChatConversation,
  options: ConversationDisplayOptions = {},
): ConversationDisplayMeta {
  const title = resolveConversationTitle(conversation, options);
  const type = trimText(conversation.type)?.toUpperCase();
  const isGroup = Boolean(type && GROUP_CONVERSATION_TYPES.has(type));
  const participantIdsCount = Array.isArray(conversation.participantUserIds)
    ? new Set(
        conversation.participantUserIds.filter((participantId) =>
          Number.isFinite(participantId),
        ),
      ).size
    : 0;
  const participantNamesCount = Array.isArray(conversation.participantNames)
    ? uniqueTexts(conversation.participantNames).length
    : 0;
  const normalizedParticipantCount =
    typeof conversation.participantCount === "number" &&
    Number.isFinite(conversation.participantCount)
      ? Math.max(0, Math.floor(conversation.participantCount))
      : 0;
  const participantCount =
    participantIdsCount > 0
      ? participantIdsCount
      : participantNamesCount > 0
        ? participantNamesCount
        : normalizedParticipantCount > 0
          ? normalizedParticipantCount
          : undefined;

  return {
    title,
    initial: title.slice(0, 1) || "?",
    isGroup,
    participantCount,
  };
}

export function matchesConversationSearch(
  conversation: ConversationDisplaySource & Pick<ChatConversation, "lastMessage">,
  keyword: string,
  options: ConversationDisplayOptions = {},
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  const title = resolveConversationTitle(conversation, options).toLowerCase();
  const lastMessage = (conversation.lastMessage || "").toLowerCase();
  const participantText = resolveParticipantLabels(conversation, options)
    .join(" ")
    .toLowerCase();

  return (
    title.includes(normalizedKeyword) ||
    lastMessage.includes(normalizedKeyword) ||
    participantText.includes(normalizedKeyword)
  );
}
