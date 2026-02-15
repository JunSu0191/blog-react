import { describe, expect, it } from "vitest";
import type { ChatConversation } from "../../../src/features/chat/api";
import {
  matchesConversationSearch,
  resolveConversationTitle,
} from "../../../src/features/chat/conversationDisplay";

function createConversation(
  overrides: Partial<ChatConversation> = {},
): ChatConversation {
  return {
    id: 1,
    title: null,
    displayTitle: "기본 대화방",
    unreadMessageCount: 0,
    ...overrides,
  };
}

describe("conversationDisplay", () => {
  it("displayTitle이 있으면 제목으로 우선 사용한다", () => {
    const conversation = createConversation({
      displayTitle: "홍길동",
      title: "레거시 제목",
    });

    expect(resolveConversationTitle(conversation)).toBe("홍길동");
  });

  it("displayTitle이 비어 있으면 title을 fallback으로 사용한다", () => {
    const conversation = createConversation({
      displayTitle: "",
      title: "레거시 제목",
    });

    expect(resolveConversationTitle(conversation)).toBe("레거시 제목");
  });

  it("검색은 displayTitle을 기준으로 동작한다", () => {
    const conversation = createConversation({
      displayTitle: "홍길동",
      title: "김철수",
      lastMessage: "안녕하세요",
    });

    expect(matchesConversationSearch(conversation, "홍길동")).toBe(true);
    expect(matchesConversationSearch(conversation, "김철수")).toBe(false);
  });

  it("마지막 메시지 검색은 기존처럼 유지된다", () => {
    const conversation = createConversation({
      displayTitle: "홍길동",
      lastMessage: "주말 일정 공유 부탁드립니다.",
    });

    expect(matchesConversationSearch(conversation, "일정 공유")).toBe(true);
  });
});
