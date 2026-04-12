self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizePushPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return normalizePushPayload(event.data ? event.data.json() : null);
    } catch {
      return null;
    }
  })();

  if (!payload) {
    event.waitUntil(
      self.registration.showNotification("새 알림", {
        body: "새 알림이 도착했습니다.",
        tag: "generic-notification",
      }),
    );
    return;
  }

  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim()
      : "새 알림";
  const body =
    typeof payload.body === "string" && payload.body.trim().length > 0
      ? payload.body.trim()
      : "새 알림이 도착했습니다.";
  const tag =
    typeof payload.tag === "string" && payload.tag.trim().length > 0
      ? payload.tag.trim()
      : undefined;
  const linkUrl =
    typeof payload.linkUrl === "string" && payload.linkUrl.trim().length > 0
      ? payload.linkUrl.trim()
      : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon:
        typeof payload.icon === "string" && payload.icon.trim().length > 0
          ? payload.icon.trim()
          : "/blog-pause-icon-tight.png",
      badge:
        typeof payload.badge === "string" && payload.badge.trim().length > 0
          ? payload.badge.trim()
          : "/blog-pause-icon-tight.png",
      data: {
        linkUrl,
        type: payload.type,
        raw: payload.data ?? null,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.linkUrl === "string"
      ? event.notification.data.linkUrl
      : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({
            type: "PUSH_NOTIFICATION_CLICKED",
            linkUrl: targetPath,
          });
          return client.focus().then(() => {
            if ("navigate" in client) {
              return client.navigate(targetPath);
            }
            return undefined;
          });
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }

      return undefined;
    }),
  );
});
