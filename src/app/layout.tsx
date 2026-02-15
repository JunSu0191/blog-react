import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, type ReactNode } from "react";
import { Bell, Home, MessageCircle, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, Badge } from "@/components/ui";
import { useAuthContext } from "../shared/context/useAuthContext";
import { Button, ThemeToggle } from "../shared/ui";
import { getUserId, getUserIdFromToken } from "@/shared/lib/auth";
import { preloadCreateFlow } from "./routePreload";
import {
  ChatUnreadRealtimeBridge,
  useChatTotalUnreadCount,
} from "@/features/chat";
import {
  NotificationBell,
  NotificationRealtimeBridge,
  useNotificationSummary,
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
  { label: "마이페이지", path: "/mypage" },
];

function HomeIcon({ active }: MobileTabIconProps) {
  return (
    <Home
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

function ChatIcon({ active }: MobileTabIconProps) {
  return (
    <MessageCircle
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

function NotificationIcon({ active }: MobileTabIconProps) {
  return (
    <Bell
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

function MyPageIcon({ active }: MobileTabIconProps) {
  return (
    <UserRound
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

const mobileBottomTabs: MobileBottomTab[] = [
  { label: "홈", path: "/posts", icon: HomeIcon },
  { label: "채팅", path: "/chat", icon: ChatIcon },
  { label: "알림", path: "/notifications", icon: NotificationIcon },
  { label: "마이", path: "/mypage", icon: MyPageIcon },
];

export default function Layout({
  children,
  menuItems = defaultMenuItems,
}: LayoutProps) {
  const { logout, token, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId =
    typeof user?.id === "number"
      ? user.id
      : (getUserId() ?? getUserIdFromToken(token) ?? undefined);
  const { data: notificationData } = useNotifications(Boolean(token));
  const { data: notificationSummary } = useNotificationSummary(Boolean(token));
  const { data: chatUnreadCount = 0 } = useChatTotalUnreadCount(currentUserId);
  const userDisplayName = useMemo(() => {
    const name = typeof user?.name === "string" ? user.name.trim() : "";
    return name || "로그인 사용자";
  }, [user?.name]);
  const userInitial = userDisplayName.slice(0, 1).toUpperCase() || "U";
  const isMobileChatConversationOpen =
    Boolean(token) &&
    location.pathname === "/chat" &&
    new URLSearchParams(location.search).has("conversationId");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const unreadNotificationCount = useMemo(() => {
    if (!token) return 0;
    if (typeof notificationSummary?.unreadCount === "number") {
      return notificationSummary.unreadCount;
    }
    const notifications = (notificationData?.pages || []).flatMap(
      (page) => page.items,
    );
    return notifications.filter((item) => !item.isRead).length;
  }, [notificationData?.pages, notificationSummary?.unreadCount, token]);
  const unreadChatCount = token ? chatUnreadCount : 0;

  const isMenuActive = (path: string) => {
    if (path === "/posts") {
      return (
        location.pathname === "/posts" ||
        /^\/posts\/\d+$/.test(location.pathname)
      );
    }
    return location.pathname === path;
  };

  const shouldRenderMobileBottomNav =
    Boolean(token) && location.pathname !== "/posts/create";
  const shouldHideMobileChatChrome = isMobileChatConversationOpen;
  const shouldUseRouteEnter = location.pathname !== "/chat";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <NotificationRealtimeBridge />
      <ChatUnreadRealtimeBridge />

      <header
        className={[
          "sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out dark:border-slate-800/90 dark:bg-slate-950/80",
          shouldHideMobileChatChrome
            ? "pointer-events-none invisible -translate-y-1 opacity-0 lg:pointer-events-auto lg:visible lg:translate-y-0 lg:opacity-100"
            : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/posts"
            className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100"
          >
            Blog Pulse
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {menuItems.map((item) => {
              const isActive = isMenuActive(item.path);
              const showChatUnreadBadge =
                item.path === "/chat" && unreadChatCount > 0;

              return (
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
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {showChatUnreadBadge && (
                      <Badge
                        className={[
                          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                          isActive
                            ? "bg-white/20 text-white hover:bg-white/20"
                            : "bg-rose-600 text-white hover:bg-rose-600",
                        ].join(" ")}
                      >
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </Badge>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {token && (
            <div className="hidden items-center gap-2 sm:gap-3 md:flex">
              <ThemeToggle />
              <NotificationBell />
              <Link
                to="/mypage"
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex"
              >
                <Avatar className="h-6 w-6 border border-blue-200/80 dark:border-blue-900/50">
                  <AvatarFallback className="bg-blue-600 text-[11px] font-bold text-white">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[10rem] truncate">
                  {userDisplayName}
                </span>
              </Link>
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
              <ThemeToggle />
              <Link to="/mypage" aria-label="마이페이지 이동">
                <Avatar className="h-8 w-8 border border-blue-200/80 dark:border-blue-900/50">
                  <AvatarFallback className="bg-blue-600 text-[11px] font-semibold text-white">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Link>
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
        <div
          key={location.pathname}
          className={shouldUseRouteEnter ? "route-enter" : undefined}
        >
          {children}
        </div>
      </main>

      {shouldRenderMobileBottomNav && (
        <nav
          className={[
            "fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200/90 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out dark:border-slate-800/90 dark:bg-slate-950/95 md:hidden",
            shouldHideMobileChatChrome
              ? "pointer-events-none invisible translate-y-3 opacity-0"
              : "translate-y-0 opacity-100",
          ].join(" ")}
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
            {mobileBottomTabs.map((tab) => {
              const isActive = isMenuActive(tab.path);
              const Icon = tab.icon;
              const badgeCount =
                tab.path === "/notifications"
                  ? unreadNotificationCount
                  : tab.path === "/chat"
                    ? unreadChatCount
                    : 0;
              const showUnreadBadge = badgeCount > 0;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={[
                    "relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  <span className="relative inline-flex">
                    <Icon active={isActive} />
                    {showUnreadBadge && (
                      <Badge className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white hover:bg-rose-600">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
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
