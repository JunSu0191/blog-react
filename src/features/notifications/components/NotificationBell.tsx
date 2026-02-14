import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import NotificationList from "./NotificationList";
import { useNotifications } from "../queries";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();

  const unreadCount = useMemo(() => {
    const notifications = (data?.pages || []).flatMap((page) => page.items);
    return notifications.filter((item) => !item.isRead).length;
  }, [data?.pages]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="알림"
        aria-label="알림 열기"
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="pointer-events-none absolute -bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700 [writing-mode:horizontal-tb]">
          알림
        </span>
      </button>

      <div
        className={[
          "absolute right-0 z-50 mt-2 w-[360px] origin-top-right rounded-2xl border border-slate-200 bg-white p-3 shadow-xl transition-all duration-220 ease-out dark:border-slate-700 dark:bg-slate-900",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0",
        ].join(" ")}
      >
        <NotificationList compact />
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="mt-3 block rounded-lg bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          전체 알림 보기
        </Link>
      </div>
    </div>
  );
}
