import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui";
import {
  useNotifications,
  useReadAllNotifications,
  useReadNotification,
} from "../queries";
import { toNotificationContent } from "../api";

export type NotificationListProps = {
  compact?: boolean;
};

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
  const readMutation = useReadNotification();
  const readAllMutation = useReadAllNotifications();

  const notifications = useMemo(
    () => (data?.pages || []).flatMap((page) => page.items),
    [data?.pages],
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

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
        <p className="text-sm font-bold text-slate-700">알림 {unreadCount}개 읽지 않음</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => readAllMutation.mutate()}
          disabled={readAllMutation.isPending || unreadCount === 0}
        >
          모두 읽음
        </Button>
      </div>

      <div className={compact ? "max-h-[340px] overflow-y-auto" : ""}>
        {isLoading && <p className="py-4 text-center text-sm text-slate-500">알림 불러오는 중...</p>}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 py-3 text-center text-sm font-semibold text-rose-700">
            알림을 불러오지 못했습니다.
          </p>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
            새 알림이 없습니다.
          </p>
        )}

        <div className="space-y-2">
          {notifications.map((item) => {
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
                    ? "border-slate-200 bg-white"
                    : "border-blue-200 bg-blue-50/60",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                      {content.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{content.body}</p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
              </button>
            );
          })}
        </div>

        {hasNextPage && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
