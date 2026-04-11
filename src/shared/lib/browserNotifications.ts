export type BrowserNotificationPayload = {
  title: string;
  body?: string;
  tag?: string;
  linkUrl?: string;
};

const BROWSER_NOTIFICATION_PERMISSION_KEY = "browser-notification-permission-requested:v1";

function isWindowAvailable() {
  return typeof window !== "undefined";
}

export function isBrowserNotificationSupported() {
  return isWindowAvailable() && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return window.Notification.permission;
}

export function shouldUseBrowserNotification() {
  if (typeof document === "undefined") return false;
  return document.hidden || !document.hasFocus();
}

export async function requestBrowserNotificationPermission(options?: {
  force?: boolean;
}) {
  if (!isBrowserNotificationSupported()) return "unsupported" as const;

  const permission = window.Notification.permission;
  if (permission === "granted" || permission === "denied") {
    return permission;
  }

  const storageKey = BROWSER_NOTIFICATION_PERMISSION_KEY;
  if (!options?.force) {
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        return permission;
      }
    } catch {
      // noop
    }
  }

  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // noop
  }

  return window.Notification.requestPermission();
}

export async function showBrowserNotification(payload: BrowserNotificationPayload) {
  if (!isBrowserNotificationSupported()) return null;

  const permission: NotificationPermission | "unsupported" =
    window.Notification.permission;
  if (permission !== "granted") return null;

  const notification = new window.Notification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    silent: false,
  });

  notification.onclick = () => {
    window.focus();
    if (payload.linkUrl) {
      window.location.href = payload.linkUrl;
    }
    notification.close();
  };

  return notification;
}
