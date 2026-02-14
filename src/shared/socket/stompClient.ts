import { API_BASE_URL } from "@/shared/lib/api";
import { getToken, getUserId, getUserIdFromToken } from "@/shared/lib/auth";
import { buildWebSocketCandidates } from "@/shared/lib/networkRuntime";

type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

type SocketState = "idle" | "connecting" | "connected";

type ChatCallback = (payload: unknown) => void;
type NotificationCallback = (payload: unknown) => void;

type ClientFrameDebug = {
  command: string;
  destination?: string;
  subscriptionId?: string;
  at: number;
  hasAuthorizationHeader: boolean;
  hasXUserIdHeader: boolean;
  userId: string | null;
};

type SendFrameDebug = ClientFrameDebug & {
  payload?: string;
};

const chatHandlers = new Map<number, Set<ChatCallback>>();
const chatSubscriptionIds = new Map<number, string>();
const notificationHandlers = new Set<NotificationCallback>();
const notificationSubscriptionIds = new Set<string>();

let ws: WebSocket | null = null;
let state: SocketState = "idle";
let subSeq = 0;
let receiptSeq = 0;
let connectAttemptTimer: number | null = null;
let activeWsUrl = "";
let reconnectCount = 0;
let preferredUserId: number | undefined;
let activeConnectUserIdHeader: string | null = null;
let lastClientFrameDebug: ClientFrameDebug | null = null;
let lastSendDebug: SendFrameDebug | null = null;
const isStompDebugEnabled = import.meta.env.VITE_STOMP_DEBUG === "true";
const devFallbackUserId = (() => {
  const raw = (import.meta.env.VITE_DEV_USER_ID as string | undefined)?.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
})();

function getStoredUserIdRaw(): string | undefined {
  try {
    const raw = localStorage.getItem("auth.userId")?.trim();
    if (!raw) return undefined;
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? String(asNumber) : undefined;
  } catch {
    return undefined;
  }
}

const wsCandidates = buildWebSocketCandidates({
  explicit: import.meta.env.VITE_WS_URL as string | undefined,
  apiBaseUrl: API_BASE_URL,
});

function nextId(prefix: string) {
  subSeq += 1;
  return `${prefix}-${subSeq}`;
}

function nextReceipt() {
  receiptSeq += 1;
  return `rcpt-${receiptSeq}`;
}

function getCurrentUserIdFromToken(): number | undefined {
  const token = getToken();
  const tokenUserId = getUserIdFromToken(token);
  if (typeof tokenUserId === "number") return tokenUserId;
  const storedUserId = getUserId();
  return typeof storedUserId === "number" ? storedUserId : undefined;
}

function getEffectiveUserId(overrideUserId?: number): number | undefined {
  return overrideUserId ?? preferredUserId ?? getCurrentUserIdFromToken() ?? devFallbackUserId;
}

function getEffectiveUserIdHeader(overrideUserId?: number): string | undefined {
  const numeric = getEffectiveUserId(overrideUserId);
  if (typeof numeric === "number") return String(numeric);

  const rawStored = getStoredUserIdRaw();
  if (rawStored) return rawStored;
  return undefined;
}

function buildAuthHeaders(overrideUserId?: number): Record<string, string> {
  const token = getToken();
  const userIdHeader = getEffectiveUserIdHeader(overrideUserId);
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.authorization = `Bearer ${token}`;
    headers["X-Authorization"] = `Bearer ${token}`;
  }

  if (userIdHeader) {
    headers["X-User-Id"] = userIdHeader;
    headers["x-user-id"] = userIdHeader;
  }

  return headers;
}

function createClientFrameDebug(command: string, headers: Record<string, string>): ClientFrameDebug {
  return {
    command,
    destination: headers.destination,
    subscriptionId: headers.id,
    at: Date.now(),
    hasAuthorizationHeader: Boolean(headers.Authorization || headers.authorization),
    hasXUserIdHeader: Boolean(headers["X-User-Id"] || headers["x-user-id"]),
    userId: headers["X-User-Id"] ?? headers["x-user-id"] ?? null,
  };
}

function buildFrame(command: string, headers: Record<string, string> = {}, body = "") {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");
  return `${command}\n${headerLines}\n\n${body}\u0000`;
}

function parseFrame(raw: string): StompFrame | null {
  const clean = raw.replace(/\u0000+$/, "");
  if (!clean.trim()) return null;

  const splitIndex = clean.indexOf("\n\n");
  const head = splitIndex >= 0 ? clean.slice(0, splitIndex) : clean;
  const body = splitIndex >= 0 ? clean.slice(splitIndex + 2) : "";

  const lines = head.split("\n");
  const command = lines.shift()?.trim();
  if (!command) return null;

  const headers: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { command, headers, body };
}

function sendFrame(command: string, headers: Record<string, string> = {}, body = "") {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  lastClientFrameDebug = createClientFrameDebug(command, headers);
  if (command === "SEND") {
    lastSendDebug = {
      ...lastClientFrameDebug,
      payload: body,
    };
  }
  ws.send(buildFrame(command, headers, body));
  return true;
}

function clearReconnectTimer() {
  if (connectAttemptTimer !== null) {
    window.clearTimeout(connectAttemptTimer);
    connectAttemptTimer = null;
  }
}

function scheduleReconnect() {
  if (typeof window === "undefined") return;
  if (connectAttemptTimer !== null) return;

  const delay = Math.min(1000 * 2 ** Math.min(reconnectCount, 4), 15000);
  connectAttemptTimer = window.setTimeout(() => {
    connectAttemptTimer = null;
    state = "idle";
    ensureConnected();
  }, delay);
}

function connectByCandidates(index = 0) {
  if (typeof window === "undefined") return;
  if (index >= wsCandidates.length) {
    console.error("[stomp] all websocket candidates failed", {
      candidates: wsCandidates,
      reconnectCount,
    });
    state = "idle";
    reconnectCount += 1;
    scheduleReconnect();
    return;
  }

  const candidateUrl = wsCandidates[index];
  if (isStompDebugEnabled) {
    console.debug("[stomp] trying candidate", {
      candidateUrl,
      index,
      reconnectCount,
    });
  }
  activeWsUrl = candidateUrl;
  ws = new WebSocket(candidateUrl, ["v12.stomp", "v11.stomp", "v10.stomp"]);

  let isStompConnected = false;

  ws.onopen = () => {
    const authHeaders = buildAuthHeaders();
    const userIdHeader = authHeaders["X-User-Id"] ?? authHeaders["x-user-id"];
    activeConnectUserIdHeader = userIdHeader ?? null;
    const connectHeaders: Record<string, string> = {
      "accept-version": "1.2,1.1,1.0",
      "heart-beat": "10000,10000",
      ...authHeaders,
    };

    console.info(
      `[stomp] CONNECT headers hasAuthorizationHeader=${Boolean(connectHeaders.Authorization)} hasXUserIdHeader=${Boolean(connectHeaders["X-User-Id"])} userId=${connectHeaders["X-User-Id"] ?? "null"}`,
    );

    sendFrame("CONNECT", connectHeaders);
  };

  ws.onmessage = (event) => {
    const chunks = String(event.data).split("\u0000");
    for (const chunk of chunks) {
      const frame = parseFrame(chunk);
      if (!frame) continue;
      if (isStompDebugEnabled) {
        console.debug("[stomp] frame", frame.command, frame.headers);
      }

      if (frame.command === "CONNECTED") {
        isStompConnected = true;
        reconnectCount = 0;
        clearReconnectTimer();
        state = "connected";
        resubscribeAll();
        continue;
      }

      if (frame.command === "MESSAGE") {
        const destination = frame.headers.destination;
        const subscription = frame.headers.subscription;

        let payload: unknown = frame.body;
        try {
          payload = JSON.parse(frame.body);
        } catch {
          // noop
        }

        if (destination?.startsWith("/topic/conversations/") || subscription?.startsWith("chat-sub-")) {
          const conversationId = Number(destination?.split("/").pop() || subscription?.split("-").pop());
          const handlers = chatHandlers.get(conversationId);
          handlers?.forEach((handler) => handler(payload));
        }

        if (
          destination?.includes("/notifications") ||
          (typeof subscription === "string" && notificationSubscriptionIds.has(subscription))
        ) {
          notificationHandlers.forEach((handler) => handler(payload));
        }
      }

      if (frame.command === "ERROR") {
        const phase = lastSendDebug ? "SEND" : "CONNECT_OR_SUBSCRIBE";
        console.error("[stomp] ERROR frame received", {
          phase,
          headers: frame.headers,
          body: frame.body,
          state,
          activeWsUrl,
          lastClientFrameDebug,
          lastSendDebug,
        });
      }
    }
  };

  ws.onerror = (event) => {
    console.warn("[stomp] websocket error", {
      candidateUrl,
      readyState: ws?.readyState,
      state,
      eventType: event.type,
    });
  };

  ws.onclose = (event) => {
    if (!isStompConnected) {
      console.warn("[stomp] websocket closed before CONNECTED", {
        candidateUrl,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    }

    ws = null;
    activeConnectUserIdHeader = null;

    if (!isStompConnected) {
      connectByCandidates(index + 1);
      return;
    }

    state = "idle";
    scheduleReconnect();
  };
}

function ensureConnected() {
  if (typeof window === "undefined") return;
  if (state === "connecting" || state === "connected") return;

  state = "connecting";
  connectByCandidates(0);
}

function resubscribeAll() {
  for (const [conversationId] of chatHandlers.entries()) {
    subscribeChatTopic(conversationId);
  }

  if (notificationHandlers.size > 0) {
    subscribeNotificationChannels();
  }
}

function subscribeChatTopic(conversationId: number) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const existing = chatSubscriptionIds.get(conversationId);
  if (existing) return;

  const subscriptionId = `chat-sub-${conversationId}-${nextId("c")}`;
  chatSubscriptionIds.set(conversationId, subscriptionId);
  sendFrame("SUBSCRIBE", {
    id: subscriptionId,
    destination: `/topic/conversations/${conversationId}`,
    ...buildAuthHeaders(),
  });
}

function unsubscribeChatTopic(conversationId: number) {
  const subId = chatSubscriptionIds.get(conversationId);
  if (!subId) return;

  sendFrame("UNSUBSCRIBE", {
    id: subId,
    ...buildAuthHeaders(),
  });
  chatSubscriptionIds.delete(conversationId);
}

function subscribeNotificationChannels() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (notificationSubscriptionIds.size > 0) return;

  const authHeaders = buildAuthHeaders();
  const queueSubId = `notif-sub-queue-${nextId("nq")}`;
  notificationSubscriptionIds.add(queueSubId);
  sendFrame("SUBSCRIBE", {
    id: queueSubId,
    destination: "/user/queue/notifications",
    ...authHeaders,
  });

  const userId = authHeaders["X-User-Id"] ?? authHeaders["x-user-id"];
  if (userId) {
    const topicSubId = `notif-sub-topic-${nextId("nt")}`;
    notificationSubscriptionIds.add(topicSubId);
    sendFrame("SUBSCRIBE", {
      id: topicSubId,
      destination: `/topic/notifications/${userId}`,
      ...authHeaders,
    });
  }
}

function unsubscribeNotificationChannels() {
  if (notificationSubscriptionIds.size === 0) return;

  const authHeaders = buildAuthHeaders();
  notificationSubscriptionIds.forEach((subscriptionId) => {
    sendFrame("UNSUBSCRIBE", {
      id: subscriptionId,
      ...authHeaders,
    });
  });
  notificationSubscriptionIds.clear();
}

export function connect(userId?: number) {
  if (typeof userId === "number") {
    preferredUserId = userId;
  }

  const desiredUserIdHeader = getEffectiveUserIdHeader(userId);
  if (
    state === "connected" &&
    desiredUserIdHeader &&
    activeConnectUserIdHeader !== desiredUserIdHeader
  ) {
    const preservedPreferredUserId = preferredUserId;
    disconnect();
    preferredUserId =
      typeof userId === "number" ? userId : preservedPreferredUserId;
  }

  ensureConnected();
}

export function disconnect() {
  clearReconnectTimer();
  if (!ws) return;

  const receipt = nextReceipt();
  sendFrame("DISCONNECT", {
    receipt,
    ...buildAuthHeaders(),
  });
  ws.close();
  ws = null;
  activeConnectUserIdHeader = null;
  state = "idle";
  reconnectCount = 0;
  notificationSubscriptionIds.clear();
  preferredUserId = undefined;
  chatSubscriptionIds.clear();
}

export function subscribeChat(conversationId: number, callback: ChatCallback) {
  const handlers = chatHandlers.get(conversationId) ?? new Set<ChatCallback>();
  handlers.add(callback);
  chatHandlers.set(conversationId, handlers);

  ensureConnected();
  subscribeChatTopic(conversationId);

  return () => {
    const current = chatHandlers.get(conversationId);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) {
      chatHandlers.delete(conversationId);
      unsubscribeChatTopic(conversationId);
    }
  };
}

export function subscribeNotifications(callback: NotificationCallback) {
  notificationHandlers.add(callback);
  ensureConnected();
  subscribeNotificationChannels();

  return () => {
    notificationHandlers.delete(callback);
    if (notificationHandlers.size === 0) {
      unsubscribeNotificationChannels();
    }
  };
}

export function sendChatMessage(
  conversationId: number,
  payload: Record<string, unknown>,
  userIdOverride?: number,
) {
  ensureConnected();
  const authHeaders = buildAuthHeaders(userIdOverride);
  return sendFrame(
    "SEND",
    {
      destination: `/app/conversations/${conversationId}/send`,
      "content-type": "application/json",
      ...authHeaders,
    },
    JSON.stringify(payload),
  );
}

export function getSocketDebugInfo() {
  return {
    state,
    activeWsUrl,
    candidates: wsCandidates,
  };
}
