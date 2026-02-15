import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChatConversation } from "../../../src/features/chat/api";
import ConversationList from "../../../src/features/chat/components/ConversationList";

function createConversation(
  overrides: Partial<ChatConversation> = {},
): ChatConversation {
  return {
    id: 1,
    type: "DIRECT",
    title: null,
    displayTitle: "기본 대화방",
    unreadMessageCount: 0,
    ...overrides,
  };
}

function renderConversationList(
  conversations: ChatConversation[],
  searchKeyword = "",
) {
  return renderToStaticMarkup(
    <ConversationList
      conversations={conversations}
      selectedConversationId={undefined}
      onSelect={() => {}}
      searchKeyword={searchKeyword}
    />,
  );
}

describe("ConversationList displayTitle rendering", () => {
  it("DIRECT + displayTitle=홍길동이면 목록에 홍길동이 노출된다", () => {
    const conversations = [
      createConversation({
        id: 11,
        type: "DIRECT",
        displayTitle: "홍길동",
        title: "direct-legacy-title",
      }),
    ];

    const html = renderConversationList(conversations);

    expect(html).toContain("홍길동");
  });

  it("GROUP + title=null + displayTitle 조합명이면 조합명이 노출된다", () => {
    const conversations = [
      createConversation({
        id: 12,
        type: "GROUP",
        title: null,
        displayTitle: "홍길동, 김철수 ...",
      }),
    ];

    const html = renderConversationList(conversations);

    expect(html).toContain("홍길동, 김철수 ...");
  });

  it("검색은 title이 아니라 displayTitle 기준으로 필터링한다", () => {
    const conversations = [
      createConversation({
        id: 13,
        type: "DIRECT",
        title: "홍길동 legacy title",
        displayTitle: "김철수",
        lastMessage: "최근 대화 없음",
      }),
      createConversation({
        id: 14,
        type: "DIRECT",
        title: "legacy",
        displayTitle: "홍길동",
        lastMessage: "최근 대화 없음",
      }),
    ];

    const html = renderConversationList(conversations, "홍길동");

    expect(html).toContain("홍길동");
    expect(html).not.toContain("김철수");
  });
});
