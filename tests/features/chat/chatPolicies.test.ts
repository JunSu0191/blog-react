import { describe, expect, it } from "vitest";
import {
  applyIncomingMessageToThread,
  canStartDirectChat,
  CHAT_LAYOUT_MODE,
  resolveChatLayoutMode,
  upsertThreadForInvite,
} from "../../../src/features/chat/chatPolicies";
import {
  CHAT_MEMBERSHIP_STATE,
  CHAT_THREAD_TYPE,
  FRIEND_RELATION_STATUS,
} from "../../../src/features/chat/chat.enums";
import type { ChatThread, Friend } from "../../../src/features/chat/types";

function createDirectThread(overrides: Partial<ChatThread> = {}): ChatThread {
  return {
    id: 11,
    type: CHAT_THREAD_TYPE.DIRECT,
    displayTitle: "홍길동",
    unreadMessageCount: 0,
    unreadCount: 0,
    membershipState: CHAT_MEMBERSHIP_STATE.ACTIVE,
    hidden: false,
    ...overrides,
  };
}

function createFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    userId: 101,
    username: "alpha",
    status: FRIEND_RELATION_STATUS.ACCEPTED,
    ...overrides,
  };
}

describe("chat policies", () => {
  it("1:1 숨김 스레드에 새 메시지가 오면 자동 노출되고 unread가 증가한다", () => {
    const hiddenThread = createDirectThread({
      hidden: true,
      membershipState: CHAT_MEMBERSHIP_STATE.HIDDEN,
      unreadMessageCount: 2,
      unreadCount: 2,
    });

    const updated = applyIncomingMessageToThread(hiddenThread, {
      threadId: hiddenThread.id,
      isActive: false,
      messageContent: "새 메시지",
      createdAt: "2026-02-17T10:00:00.000Z",
    });

    expect(updated.hidden).toBe(false);
    expect(updated.membershipState).toBe(CHAT_MEMBERSHIP_STATE.ACTIVE);
    expect(updated.unreadMessageCount).toBe(3);
    expect(updated.lastMessage).toBe("새 메시지");
  });

  it("친구가 아닌 사용자와는 1:1 시작이 차단된다", () => {
    const friends = [createFriend({ userId: 1, status: FRIEND_RELATION_STATUS.ACCEPTED })];

    expect(canStartDirectChat(friends, 2)).toBe(false);
  });

  it("친구 요청 수락 상태가 되면 1:1 시작이 가능해진다", () => {
    const pendingFriend = createFriend({
      userId: 9,
      status: FRIEND_RELATION_STATUS.PENDING,
    });

    expect(canStartDirectChat([pendingFriend], 9)).toBe(false);

    const acceptedFriend = {
      ...pendingFriend,
      status: FRIEND_RELATION_STATUS.ACCEPTED,
    };
    expect(canStartDirectChat([acceptedFriend], 9)).toBe(true);
  });

  it("그룹 초대 수락 후 대상 스레드를 즉시 목록에 upsert한다", () => {
    const current = [createDirectThread({ id: 30 })];
    const invitedGroup = createDirectThread({
      id: 77,
      type: CHAT_THREAD_TYPE.GROUP,
      displayTitle: "프로젝트 그룹",
    });

    const next = upsertThreadForInvite(current, invitedGroup);

    expect(next[0].id).toBe(77);
    expect(next.find((thread) => thread.id === 30)).toBeTruthy();
  });

  it("뷰포트 폭 기준으로 모바일/데스크톱 레이아웃 모드를 구분한다", () => {
    expect(resolveChatLayoutMode(375)).toBe(CHAT_LAYOUT_MODE.MOBILE);
    expect(resolveChatLayoutMode(1280)).toBe(CHAT_LAYOUT_MODE.DESKTOP);
  });
});

