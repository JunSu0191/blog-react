import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui";
import {
  useNotificationSummary,
  useNotifications,
  useReadAllNotifications,
  useReadNotification,
} from "../queries";
import { toNotificationContent } from "../api";

export type NotificationListProps = {
  compact?: boolean;
};

const NOTIFICATION_BATCH_SIZE = 30;

function formatDateTime(raw?: string) {
  if (!raw) return "";
  return new Date(raw).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationList({ compact = false }: NotificationListProps) {
  const navigate = useNavigate();
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const { data: summary } = useNotificationSummary();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(NOTIFICATION_BATCH_SIZE);
  const readMutation = useReadNotification();
  const readAllMutation = useReadAllNotifications();

  const notifications = useMemo(() => {
    const merged = (data?.pages || []).flatMap((page) => page.items);
    const byId = new Map<number, (typeof merged)[number]>();
    merged.forEach((item) => {
      if (typeof item.id === "number") byId.set(item.id, item);
    });
    return Array.from(byId.values()).sort((a, b) => b.id - a.id);
  }, [data?.pages]);

  useEffect(() => {
    setVisibleCount((prev) =>
      Math.min(
        Math.max(NOTIFICATION_BATCH_SIZE, prev),
        Math.max(NOTIFICATION_BATCH_SIZE, notifications.length),
      ),
    );
  }, [notifications.length]);

  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount],
  );
  const hasMoreVisibleItems = visibleCount < notifications.length;

  const loadedUnreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );
  const unreadCount =
    typeof summary?.unreadCount === "number"
      ? summary.unreadCount
      : hasNextPage
        ? undefined
        : loadedUnreadCount;
  const unreadCountLabel =
    typeof unreadCount === "number"
      ? `${unreadCount}개 읽지 않음`
      : "읽지 않음 집계 중...";

  useEffect(() => {
    if (!hasNextPage && !hasMoreVisibleItems) return;
    const target = loadMoreTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (hasMoreVisibleItems) {
          setVisibleCount((prev) =>
            Math.min(prev + NOTIFICATION_BATCH_SIZE, notifications.length),
          );
          return;
        }
        if (isFetchingNextPage || !hasNextPage) return;
        void fetchNextPage();
      },
      {
        root: compact ? scrollContainerRef.current : null,
        rootMargin: "120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    compact,
    fetchNextPage,
    hasMoreVisibleItems,
    hasNextPage,
    isFetchingNextPage,
    notifications.length,
  ]);

  const moveToLink = (linkUrl?: string) => {
    if (!linkUrl) return;

    if (/^https?:\/\//i.test(linkUrl)) {
      window.location.href = linkUrl;
      return;
    }

    navigate(linkUrl);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          알림 {unreadCountLabel}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => readAllMutation.mutate()}
          disabled={
            readAllMutation.isPending ||
            (typeof unreadCount === "number" && unreadCount === 0)
          }
        >
          모두 읽음
        </Button>
      </div>

      <div
        ref={scrollContainerRef}
        className={compact ? "max-h-[340px] overflow-y-auto overscroll-contain pr-1" : ""}
      >
        {isLoading && <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">알림 불러오는 중...</p>}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 py-3 text-center text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            알림을 불러오지 못했습니다.
          </p>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            새 알림이 없습니다.
          </p>
        )}

        <div className="space-y-2">
          {visibleNotifications.map((item) => {
            const content = toNotificationContent(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.isRead) readMutation.mutate(item.id);
                  moveToLink(content.linkUrl);
                }}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left transition",
                  item.isRead
                    ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    : "border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {content.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{content.body}</p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(item.createdAt)}</p>
              </button>
            );
          })}
        </div>

        {(hasMoreVisibleItems || hasNextPage) && (
          <div
            ref={loadMoreTriggerRef}
            className="mt-2 flex h-8 items-center justify-center"
            aria-hidden="true"
          >
            {isFetchingNextPage && !hasMoreVisibleItems && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                알림 불러오는 중...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
