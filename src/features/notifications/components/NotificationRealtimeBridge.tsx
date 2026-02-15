import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { connect, subscribeNotifications } from "@/shared/socket/stompClient";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { getToken, getUserId, getUserIdFromToken } from "@/shared/lib/auth";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  toNotification,
  toNotificationContent,
  type NotificationItem,
  type NotificationPage,
  type NotificationSummary,
} from "../api";
import { notificationSummaryQueryKey, useNotifications } from "../queries";

type RealtimeNotificationExtractResult = {
  item: NotificationItem | null;
  fallbackMessage?: string;
  dedupeSignature?: string;
};

const TOAST_DEDUPE_TTL_MS = 10_000;

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function buildNotificationSignature(input: {
  type?: string;
  payload?: unknown;
  title?: string;
  body?: string;
  createdAt?: string;
}) {
  const payload = toObjectRecord(input.payload);
  const identityFields = [
    toNonEmptyString(payload?.messageId),
    toNonEmptyString(payload?.commentId),
    toNonEmptyString(payload?.conversationId),
    toNonEmptyString(payload?.postId),
    toNonEmptyString(payload?.senderId),
    toNonEmptyString(payload?.commenterId),
    toNonEmptyString(payload?.parentCommentId),
  ].filter((value): value is string => Boolean(value));

  const contentFields = [
    toNonEmptyString(input.title),
    toNonEmptyString(input.body),
    toNonEmptyString(input.createdAt),
  ].filter((value): value is string => Boolean(value));

  const signatureBody =
    identityFields.length > 0
      ? identityFields.join("|")
      : contentFields.length > 0
        ? contentFields.join("|")
        : undefined;

  if (!signatureBody && !input.type) return undefined;
  return `sig:${input.type || "UNKNOWN"}:${signatureBody || "NO_CONTENT"}`;
}

function buildSignatureFromItem(item: NotificationItem) {
  return buildNotificationSignature({
    type: item.type,
    payload: item.payload,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt,
  });
}

function buildSignatureFromCandidate(candidate: Record<string, unknown>) {
  return buildNotificationSignature({
    type: toNonEmptyString(candidate.type),
    payload: candidate.payload,
    title: toNonEmptyString(candidate.title),
    body: toNonEmptyString(candidate.body) || toNonEmptyString(candidate.message),
    createdAt: toNonEmptyString(candidate.createdAt),
  });
}

function hasRecentDedupeKey(cache: Map<string, number>, key: string, now: number) {
  const expiresAt = cache.get(key);
  return typeof expiresAt === "number" && expiresAt > now;
}

function pruneExpiredDedupeKeys(cache: Map<string, number>, now: number) {
  cache.forEach((expiresAt, key) => {
    if (expiresAt <= now) {
      cache.delete(key);
    }
  });
}

function shouldSkipByDedupeKeys(
  cache: Map<string, number>,
  dedupeKeys: string[],
  now: number = Date.now(),
) {
  pruneExpiredDedupeKeys(cache, now);
  return dedupeKeys.some((key) => hasRecentDedupeKey(cache, key, now));
}

function rememberDedupeKeys(cache: Map<string, number>, dedupeKeys: string[], now: number = Date.now()) {
  const expiresAt = now + TOAST_DEDUPE_TTL_MS;
  dedupeKeys.forEach((key) => cache.set(key, expiresAt));
}

function collectDedupeKeys(item: NotificationItem | null, signature?: string) {
  const keys: string[] = [];
  if (item) {
    keys.push(`id:${item.id}`);
  }
  if (signature) {
    keys.push(signature);
  }
  return keys;
}

function getToastLevel(item: NotificationItem | null | undefined) {
  if (!item?.type) return "info" as const;
  if (item.type === "POST_COMMENT") return "success" as const;
  if (item.type === "CHAT_MESSAGE") return "info" as const;
  return "info" as const;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractConversationIdFromNotification(notification: NotificationItem): number | undefined {
  const payloadConversationId = toFiniteNumber(notification.payload?.conversationId);
  if (typeof payloadConversationId === "number") return payloadConversationId;

  if (typeof notification.linkUrl !== "string" || notification.linkUrl.length === 0) {
    return undefined;
  }

  try {
    const url = new URL(notification.linkUrl, window.location.origin);
    const conversationId = toFiniteNumber(url.searchParams.get("conversationId"));
    return conversationId;
  } catch {
    return undefined;
  }
}

function shouldSuppressChatToast(
  notification: NotificationItem,
  activeConversationId?: number,
): boolean {
  if (typeof activeConversationId !== "number") return false;
  if (notification.type !== "CHAT_MESSAGE") return false;
  const targetConversationId = extractConversationIdFromNotification(notification);
  return targetConversationId === activeConversationId;
}

function extractNotification(payload: unknown): RealtimeNotificationExtractResult | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  const hasEnvelope =
    (!!obj.notification && typeof obj.notification === "object") ||
    (!!obj.data && typeof obj.data === "object");

  if (hasEnvelope) {
    const type = obj.type;
    if (type && type !== "NOTIFICATION_CREATED") return null;
  }

  const candidate =
    hasEnvelope
      ? ((obj.notification as Record<string, unknown> | undefined) ||
        (obj.data as Record<string, unknown> | undefined) ||
        obj)
      : obj;

  const item = toNotification(candidate);
  if (item) {
    return {
      item,
      dedupeSignature: buildSignatureFromItem(item),
    };
  }

  // 백엔드가 가끔 id=null로 이벤트를 보낼 수 있으므로, 이 경우에도 토스트는 노출한다.
  const fallbackBody =
    (typeof candidate.body === "string" && candidate.body) ||
    (typeof candidate.message === "string" && candidate.message) ||
    (typeof candidate.title === "string" && candidate.title) ||
    undefined;

  return {
    item: null,
    fallbackMessage: fallbackBody || "새 알림이 도착했습니다.",
    dedupeSignature: buildSignatureFromCandidate(candidate),
  };
}

export default function NotificationRealtimeBridge() {
  const { token, user } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const effectiveToken = token ?? getToken();
  const { data: notificationData } = useNotifications(Boolean(effectiveToken));
  const isInitialLoadRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const recentToastDedupeRef = useRef<Map<string, number>>(new Map());
  const currentUserId =
    typeof user?.id === "number"
      ? user.id
      : getUserId() ?? getUserIdFromToken(effectiveToken) ?? undefined;
  const activeConversationId = useMemo(() => {
    if (location.pathname !== "/chat") return undefined;
    const rawConversationId = new URLSearchParams(location.search).get("conversationId");
    if (!rawConversationId) return undefined;
    const parsed = Number(rawConversationId);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (effectiveToken) return;
    isInitialLoadRef.current = false;
    seenNotificationIdsRef.current.clear();
    recentToastDedupeRef.current.clear();
  }, [effectiveToken]);

  useEffect(() => {
    if (!effectiveToken) {
      console.warn("[notifications] realtime disabled: no token");
      return;
    }
    console.info("[notifications] realtime bridge connected", {
      hasToken: Boolean(effectiveToken),
      currentUserId: currentUserId ?? null,
    });

    connect(currentUserId);
    const unsubscribe = subscribeNotifications((payload) => {
      const extracted = extractNotification(payload);
      if (!extracted) return;

      // 초기 동기화 전에는 과거 알림으로 인한 토스트 스팸을 막고 기준선만 수집한다.
      if (!isInitialLoadRef.current) {
        if (extracted.item) {
          seenNotificationIdsRef.current.add(extracted.item.id);
        }
        const bootstrappingKeys = collectDedupeKeys(extracted.item, extracted.dedupeSignature);
        if (bootstrappingKeys.length > 0) {
          rememberDedupeKeys(recentToastDedupeRef.current, bootstrappingKeys);
        }
        return;
      }

      // id가 없어도 토스트는 즉시 노출하고, 목록은 서버 재조회로 동기화한다.
      if (!extracted.item) {
        const fallbackKeys = collectDedupeKeys(null, extracted.dedupeSignature);
        if (
          fallbackKeys.length > 0 &&
          shouldSkipByDedupeKeys(recentToastDedupeRef.current, fallbackKeys)
        ) {
          return;
        }
        if (fallbackKeys.length > 0) {
          rememberDedupeKeys(recentToastDedupeRef.current, fallbackKeys);
        }

        showToast(extracted.fallbackMessage || "새 알림이 도착했습니다.", "info");
        void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
        void queryClient.invalidateQueries({ queryKey: notificationSummaryQueryKey() });
        return;
      }
      const notification = extracted.item;
      if (seenNotificationIdsRef.current.has(notification.id)) return;

      const dedupeKeys = collectDedupeKeys(notification, extracted.dedupeSignature);
      if (
        dedupeKeys.length > 0 &&
        shouldSkipByDedupeKeys(recentToastDedupeRef.current, dedupeKeys)
      ) {
        seenNotificationIdsRef.current.add(notification.id);
        return;
      }
      if (dedupeKeys.length > 0) {
        rememberDedupeKeys(recentToastDedupeRef.current, dedupeKeys);
      }

      const existing = queryClient.getQueryData(["notifications", "list"]) as {
        pages?: NotificationPage[];
      } | null;
      const alreadyExists = Boolean(
        existing?.pages?.some((page) => page.items.some((item) => item.id === notification.id)),
      );
      if (alreadyExists) return;

      seenNotificationIdsRef.current.add(notification.id);
      const content = toNotificationContent(notification);
      if (!shouldSuppressChatToast(notification, activeConversationId)) {
        showToast(
          content.title || content.body || "새 알림이 도착했습니다.",
          getToastLevel(notification),
        );
      }

      queryClient.setQueryData(["notifications", "list"], (prev: unknown) => {
        if (!prev || typeof prev !== "object") {
          return {
            pageParams: [undefined],
            pages: [{ items: [notification], hasMore: false, nextCursorId: undefined }],
          };
        }

        const old = prev as {
          pages: Array<{ items: NotificationItem[]; hasMore: boolean; nextCursorId?: number }>;
          pageParams: unknown[];
        };

        const firstPage = old.pages[0] || { items: [], hasMore: false, nextCursorId: undefined };
        const exists = firstPage.items.some((item) => item.id === notification.id);
        if (exists) return old;

        const updatedFirst = {
          ...firstPage,
          items: [notification, ...firstPage.items],
        };

        return {
          ...old,
          pages: [updatedFirst, ...old.pages.slice(1)],
        };
      });
      queryClient.setQueryData<NotificationSummary | undefined>(
        notificationSummaryQueryKey(),
        (prev) => {
          if (!prev) return prev;
          return {
            totalCount: prev.totalCount + 1,
            unreadCount: prev.unreadCount + (notification.isRead ? 0 : 1),
          };
        },
      );

      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    });

    return unsubscribe;
  }, [activeConversationId, currentUserId, effectiveToken, queryClient, showToast]);

  useEffect(() => {
    if (!effectiveToken) return;
    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    }, 7000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [effectiveToken, queryClient]);

  useEffect(() => {
    if (!effectiveToken) return;
    if (!notificationData || !Array.isArray(notificationData.pages)) return;

    const latestItems = notificationData?.pages?.[0]?.items || [];

    if (!isInitialLoadRef.current) {
      latestItems.forEach((item) => seenNotificationIdsRef.current.add(item.id));
      isInitialLoadRef.current = true;
      return;
    }

    const newItems = latestItems
      .filter((item) => !seenNotificationIdsRef.current.has(item.id))
      .sort((a, b) => a.id - b.id);

    newItems.forEach((item) => {
      const dedupeKeys = collectDedupeKeys(item, buildSignatureFromItem(item));
      if (
        dedupeKeys.length > 0 &&
        shouldSkipByDedupeKeys(recentToastDedupeRef.current, dedupeKeys)
      ) {
        seenNotificationIdsRef.current.add(item.id);
        return;
      }
      if (dedupeKeys.length > 0) {
        rememberDedupeKeys(recentToastDedupeRef.current, dedupeKeys);
      }

      seenNotificationIdsRef.current.add(item.id);
      const content = toNotificationContent(item);
      if (!shouldSuppressChatToast(item, activeConversationId)) {
        showToast(content.title || content.body || "새 알림이 도착했습니다.", getToastLevel(item));
      }
    });
  }, [activeConversationId, effectiveToken, notificationData, showToast]);

  return null;
}
