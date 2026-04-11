import { describe, expect, it } from "vitest";
import { toNotificationContent, type NotificationItem } from "../../../src/features/notifications/api";

function createNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 1,
    isRead: false,
    ...overrides,
  };
}

describe("notification content", () => {
  it("친구 요청 수신 알림을 기본 문구로 변환한다", () => {
    const content = toNotificationContent(
      createNotification({
        type: "FRIEND_REQUEST_RECEIVED",
      }),
    );

    expect(content.title).toBe("친구 요청");
    expect(content.body).toContain("친구 요청");
    expect(content.linkUrl).toBe("/chat");
  });

  it("친구 요청 수락 알림은 chat 링크로 이동한다", () => {
    const content = toNotificationContent(
      createNotification({
        type: "FRIEND_REQUEST_ACCEPTED",
      }),
    );

    expect(content.title).toBe("친구 요청 수락");
    expect(content.linkUrl).toBe("/chat");
  });
});
