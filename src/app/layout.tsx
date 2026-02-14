import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, type ReactNode } from "react";
import { useAuthContext } from "../shared/context/useAuthContext";
import { Button } from "../shared/ui";
import { preloadCreateFlow } from "./routePreload";
import {
  NotificationBell,
  NotificationRealtimeBridge,
  useNotifications,
} from "@/features/notifications";

interface MenuItem {
  label: string;
  path: string;
}

interface LayoutProps {
  children: ReactNode;
  menuItems?: MenuItem[];
}

type MobileTabIconProps = {
  active: boolean;
};

type MobileBottomTab = {
  label: string;
  path: string;
  icon: (props: MobileTabIconProps) => ReactNode;
};

const defaultMenuItems: MenuItem[] = [
  { label: "피드", path: "/posts" },
  { label: "글쓰기", path: "/posts/create" },
  { label: "채팅", path: "/chat" },
];

function HomeIcon({ active }: MobileTabIconProps) {
  return (
    <svg
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function ChatIcon({ active }: MobileTabIconProps) {
  return (
    <svg
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H4l2.2-3.3A8.5 8.5 0 1 1 21 12Z" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14h5" />
    </svg>
  );
}

function NotificationIcon({ active }: MobileTabIconProps) {
  return (
    <svg
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

const mobileBottomTabs: MobileBottomTab[] = [
  { label: "홈", path: "/posts", icon: HomeIcon },
  { label: "채팅", path: "/chat", icon: ChatIcon },
  { label: "알림", path: "/notifications", icon: NotificationIcon },
];

export default function Layout({
  children,
  menuItems = defaultMenuItems,
}: LayoutProps) {
  const { logout, token, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notificationData } = useNotifications(Boolean(token));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const unreadNotificationCount = useMemo(() => {
    if (!token) return 0;
    const notifications = (notificationData?.pages || []).flatMap((page) => page.items);
    return notifications.filter((item) => !item.isRead).length;
  }, [notificationData?.pages, token]);

  const isMenuActive = (path: string) => {
    if (path === "/posts") {
      return (
        location.pathname === "/posts" ||
        /^\/posts\/\d+$/.test(location.pathname)
      );
    }
    return location.pathname === path;
  };

  const shouldShowMobileBottomNav =
    Boolean(token) && location.pathname !== "/posts/create";

  return (
    <div className="min-h-screen bg-slate-50">
      <NotificationRealtimeBridge />

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/posts"
            className="text-lg font-black tracking-tight text-slate-900"
          >
            Blog Pulse
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => {
                  if (item.path === "/posts/create") {
                    void preloadCreateFlow();
                  }
                }}
                onFocus={() => {
                  if (item.path === "/posts/create") {
                    void preloadCreateFlow();
                  }
                }}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  isMenuActive(item.path)
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {token && (
            <div className="hidden items-center gap-2 sm:gap-3 md:flex">
              <NotificationBell />
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">
                  {user?.username?.slice(0, 1).toUpperCase() || "U"}
                </span>
                {user?.username || "로그인 사용자"}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="rounded-xl"
              >
                로그아웃
              </Button>
            </div>
          )}

          {token && (
            <div className="flex items-center gap-2 md:hidden">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                {user?.username?.slice(0, 1).toUpperCase() || "U"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-8 rounded-lg px-2.5 text-[11px]"
              >
                로그아웃
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-6 lg:px-8">
        <div key={location.pathname} className="route-enter">
          {children}
        </div>
      </main>

      {shouldShowMobileBottomNav && (
        <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200/90 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            {mobileBottomTabs.map((tab) => {
              const isActive = isMenuActive(tab.path);
              const Icon = tab.icon;
              const showUnreadBadge = tab.path === "/notifications" && unreadNotificationCount > 0;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={[
                    "relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  <span className="relative inline-flex">
                    <Icon active={isActive} />
                    {showUnreadBadge && (
                      <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </span>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
