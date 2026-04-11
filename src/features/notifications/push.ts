import { API_BASE_URL, api } from "@/shared/lib/api";

export type BrowserPushPlatform =
  | "desktop"
  | "android"
  | "ios_limited"
  | "unsupported";

export type BrowserPushSupport = {
  supported: boolean;
  platform: BrowserPushPlatform;
  reason?: string;
};

export type BrowserPushRegistrationResult = {
  supported: boolean;
  state: "subscribed" | "unsupported" | "permission_denied" | "failed";
  reason?: string;
};

export type BrowserPushStatus = {
  permission: NotificationPermission | "unsupported";
  support: BrowserPushSupport;
  subscribed: boolean;
};

type SerializablePushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
};

const PUSH_PUBLIC_KEY_ENDPOINT = `${API_BASE_URL}/notifications/push/public-key`;
const PUSH_SUBSCRIPTIONS_ENDPOINT = `${API_BASE_URL}/notifications/push-subscriptions`;
const SERVICE_WORKER_PATH = "/service-worker.js";

function isWindowAvailable() {
  return typeof window !== "undefined";
}

function isNavigatorAvailable() {
  return typeof navigator !== "undefined";
}

function isIosDevice() {
  if (!isNavigatorAvailable()) return false;
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(userAgent);
}

function isAndroidDevice() {
  if (!isNavigatorAvailable()) return false;
  return /Android/i.test(navigator.userAgent || "");
}

function supportsServiceWorkerPush() {
  return (
    isWindowAvailable() &&
    "Notification" in window &&
    isNavigatorAvailable() &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function arrayBufferToBase64(value: ArrayBuffer | null) {
  if (!value) return "";
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((item) => {
    binary += String.fromCharCode(item);
  });
  return btoa(binary);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function normalizePushPublicKey(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }

  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidates = [
    obj.publicKey,
    obj.vapidPublicKey,
    obj.key,
    obj.public_key,
    obj.vapid_public_key,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

async function getPushPublicKey() {
  const response = await api<unknown>(PUSH_PUBLIC_KEY_ENDPOINT);
  const publicKey = normalizePushPublicKey(response);
  if (!publicKey) {
    throw new Error("웹 푸시 공개키를 가져오지 못했습니다.");
  }
  return publicKey;
}

function serializePushSubscription(subscription: PushSubscription): SerializablePushSubscription {
  const raw = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh:
        raw.keys?.p256dh ||
        arrayBufferToBase64(subscription.getKey("p256dh")),
      auth:
        raw.keys?.auth ||
        arrayBufferToBase64(subscription.getKey("auth")),
    },
    userAgent: isNavigatorAvailable() ? navigator.userAgent : undefined,
  };
}

async function upsertPushSubscription(subscription: PushSubscription) {
  const payload = serializePushSubscription(subscription);
  await api<void>(PUSH_SUBSCRIPTIONS_ENDPOINT, {
    method: "POST",
    data: payload,
  });
}

async function deletePushSubscription(endpoint: string) {
  await api<void>(PUSH_SUBSCRIPTIONS_ENDPOINT, {
    method: "DELETE",
    data: { endpoint },
  });
}

export function getBrowserPushSupport(): BrowserPushSupport {
  if (!supportsServiceWorkerPush()) {
    return {
      supported: false,
      platform: "unsupported",
      reason: "이 브라우저는 웹 푸시를 지원하지 않습니다.",
    };
  }

  if (isIosDevice()) {
    return {
      supported: true,
      platform: "ios_limited",
      reason: "iOS/iPadOS는 Safari/PWA 정책에 따라 웹 푸시 동작이 제한될 수 있습니다.",
    };
  }

  if (isAndroidDevice()) {
    return {
      supported: true,
      platform: "android",
    };
  }

  return {
    supported: true,
    platform: "desktop",
  };
}

export async function ensureNotificationServiceWorker() {
  if (!supportsServiceWorkerPush()) return null;
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH);
}

export async function getCurrentPushSubscription() {
  if (!supportsServiceWorkerPush()) return null;
  const registration = await ensureNotificationServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function getBrowserPushStatus(): Promise<BrowserPushStatus> {
  const support = getBrowserPushSupport();
  const permission =
    isWindowAvailable() && "Notification" in window
      ? window.Notification.permission
      : "unsupported";
  const subscription = await getCurrentPushSubscription();
  return {
    permission,
    support,
    subscribed: Boolean(subscription),
  };
}

export async function syncBrowserPushSubscription() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  await upsertPushSubscription(subscription);
}

export async function registerBrowserPush(): Promise<BrowserPushRegistrationResult> {
  const support = getBrowserPushSupport();
  if (!support.supported) {
    return {
      supported: false,
      state: "unsupported",
      reason: support.reason,
    };
  }

  if (!isWindowAvailable() || !("Notification" in window)) {
    return {
      supported: false,
      state: "unsupported",
      reason: "알림 API를 사용할 수 없습니다.",
    };
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") {
    return {
      supported: true,
      state: "permission_denied",
      reason: "브라우저 알림 권한이 허용되지 않았습니다.",
    };
  }

  try {
    const registration = await ensureNotificationServiceWorker();
    if (!registration) {
      return {
        supported: false,
        state: "unsupported",
        reason: "서비스 워커를 등록할 수 없습니다.",
      };
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await upsertPushSubscription(existingSubscription);
      return {
        supported: true,
        state: "subscribed",
      };
    }

    const publicKey = await getPushPublicKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await upsertPushSubscription(subscription);

    return {
      supported: true,
      state: "subscribed",
    };
  } catch (error) {
    return {
      supported: true,
      state: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "브라우저 알림 구독 설정에 실패했습니다.",
    };
  }
}

export async function unregisterBrowserPush() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    return { success: true };
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  try {
    await deletePushSubscription(endpoint);
  } catch {
    // 브라우저 구독 해지는 성공했으므로 서버 정리는 재시도 가능 상태로 둔다.
  }

  return { success: true };
}
