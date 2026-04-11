import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Compass,
  FileText,
  Home,
  Lock,
  Loader2,
  LogIn,
  MessageCircle,
  PenSquare,
  Search,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, Badge } from "@/components/ui";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuthContext } from "../shared/context/useAuthContext";
import { ActionDialog, Button, ThemeToggle } from "../shared/ui";
import { preloadCreateFlow } from "./routePreload";
import { usePostFeed } from "@/features/post/queries";
import { resolvePostPath } from "@/features/post/utils/postContent";
import {
  ChatUnreadRealtimeBridge,
  useChatTotalUnreadCount,
} from "@/features/chat";
import {
  NotificationBell,
  NotificationRealtimeBridge,
} from "@/features/notifications";
import { resolveDisplayName } from "@/shared/lib/displayName";

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
  adminOnly?: boolean;
  requiresAuth?: boolean;
  badgeType?: "chat";
};

const defaultMenuItems: MenuItem[] = [
  { label: "홈", path: "/home" },
  { label: "탐색", path: "/posts" },
  { label: "작성", path: "/posts/create" },
  { label: "메시지", path: "/chat" },
  { label: "내 공간", path: "/mypage" },
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

function ExploreIcon({ active }: MobileTabIconProps) {
  return (
    <Compass
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

function WriteIcon({ active }: MobileTabIconProps) {
  return (
    <PenSquare
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

function AdminIcon({ active }: MobileTabIconProps) {
  return (
    <Shield
      className={["h-5 w-5 transition", active ? "scale-[1.03]" : ""].join(" ")}
      aria-hidden="true"
    />
  );
}

const mobileBottomTabs: MobileBottomTab[] = [
  { label: "홈", path: "/home", icon: HomeIcon },
  { label: "탐색", path: "/posts", icon: ExploreIcon },
  { label: "작성", path: "/posts/create", icon: WriteIcon, requiresAuth: true },
  {
    label: "메시지",
    path: "/chat",
    icon: ChatIcon,
    requiresAuth: true,
    badgeType: "chat",
  },
  { label: "내 공간", path: "/mypage", icon: MyPageIcon, requiresAuth: true },
  {
    label: "관리",
    path: "/admin/dashboard",
    icon: AdminIcon,
    adminOnly: true,
    requiresAuth: true,
  },
];

function formatSpotlightDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default function Layout({
  children,
  menuItems = defaultMenuItems,
}: LayoutProps) {
  const { logout, token, user, isLoadingUser } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const isRestoringSession = Boolean(token) && !user && isLoadingUser;
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId =
    typeof user?.id === "number" ? user.id : undefined;
  const { data: chatUnreadCount = 0 } = useChatTotalUnreadCount(currentUserId);
  const userDisplayName = useMemo(() => {
    return resolveDisplayName(user || {}, "로그인 사용자");
  }, [user]);
  const myBlogPath = useMemo(() => {
    const username = typeof user?.username === "string" ? user.username.trim() : "";
    return username ? `/${encodeURIComponent(username)}` : "/login";
  }, [user]);
  const userInitial = userDisplayName.slice(0, 1).toUpperCase() || "U";
  const isMobileChatConversationOpen =
    isAuthenticated &&
    location.pathname === "/chat" &&
    new URLSearchParams(location.search).has("conversationId");
  const activeFeedSearchKeyword = useMemo(
    () => new URLSearchParams(location.search).get("q")?.trim() ?? "",
    [location.search],
  );
  const [spotlightSearchKeyword, setSpotlightSearchKeyword] = useState(
    activeFeedSearchKeyword,
  );
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authIntentPath, setAuthIntentPath] = useState<string>("/home");
  const normalizedSpotlightKeyword = spotlightSearchKeyword.trim();
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;

  const spotlightSearchQuery = usePostFeed(
    {
      q: normalizedSpotlightKeyword,
      page: 0,
      size: 8,
    },
    {
      enabled: isSpotlightOpen && normalizedSpotlightKeyword.length > 0,
    },
  );
  const spotlightPosts = useMemo(
    () => spotlightSearchQuery.data?.content ?? [],
    [spotlightSearchQuery.data?.content],
  );

  const handleLogout = () => {
    logout();
    navigate("/home");
  };
  const openLoginPrompt = useCallback((path?: string) => {
    setAuthIntentPath(path || currentPathWithSearchHash);
    setIsAuthDialogOpen(true);
  }, [currentPathWithSearchHash]);

  const navigateWithAuth = useCallback((path: string, requiresAuth = false) => {
    if (requiresAuth && !isAuthenticated) {
      openLoginPrompt(path);
      return;
    }
    navigate(path);
  }, [isAuthenticated, navigate, openLoginPrompt]);

  const applyFeedSearch = (keyword: string) => {
    const normalizedKeyword = keyword.trim();
    const nextSearchParams = new URLSearchParams();
    if (normalizedKeyword.length > 0) {
      nextSearchParams.set("q", normalizedKeyword);
    }

    const nextSearchText = nextSearchParams.toString();
    const currentKeyword = new URLSearchParams(location.search).get("q")?.trim() ?? "";
    if (location.pathname === "/search" && currentKeyword === normalizedKeyword) {
      setIsSpotlightOpen(false);
      return;
    }
    navigate(
      {
        pathname: "/search",
        search: nextSearchText ? `?${nextSearchText}` : "",
      },
      { replace: location.pathname === "/search" },
    );
    setIsSpotlightOpen(false);
  };
  const openSpotlightSearch = useCallback(() => {
    setSpotlightSearchKeyword(activeFeedSearchKeyword);
    setIsSpotlightOpen(true);
  }, [activeFeedSearchKeyword]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      openSpotlightSearch();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openSpotlightSearch]);

  const unreadChatCount = isAuthenticated ? chatUnreadCount : 0;
  const isAdminUser = user?.role?.toUpperCase() === "ADMIN";
  const resolvedMenuItems = useMemo(() => {
    const baseItems = [...menuItems];
    const normalizedRole = user?.role?.toUpperCase();
    if (normalizedRole !== "ADMIN") return baseItems;
    const hasAdmin = baseItems.some((item) => item.path === "/admin/dashboard");
    if (hasAdmin) return baseItems;
    return [...baseItems, { label: "관리자", path: "/admin/dashboard" }];
  }, [menuItems, user?.role]);

  const isMenuActive = (path: string) => {
    if (path === "/home") {
      return location.pathname === "/home";
    }
    if (path === "/posts") {
      return (
        location.pathname === "/posts" ||
        location.pathname === "/search" ||
        location.pathname.startsWith("/categories/") ||
        location.pathname.startsWith("/tags/") ||
        /^\/posts\/\d+$/.test(location.pathname) ||
        /^\/posts\/\d+\/edit$/.test(location.pathname)
      );
    }
    if (path === "/admin/dashboard") {
      return location.pathname.startsWith("/admin");
    }
    if (path === "/mypage") {
      return location.pathname === "/mypage" || location.pathname.startsWith("/mypage/");
    }
    return location.pathname === path;
  };

  const shouldRenderMobileBottomNav = true;
  const shouldHideMobileChatChrome = isMobileChatConversationOpen;
  const shouldUseRouteEnter = location.pathname !== "/chat";
  const visibleMobileBottomTabs = useMemo(
    () =>
      mobileBottomTabs.filter((tab) =>
        tab.adminOnly ? isAdminUser : true,
      ),
    [isAdminUser],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {isAuthenticated ? <NotificationRealtimeBridge /> : null}
      {isAuthenticated ? <ChatUnreadRealtimeBridge /> : null}

      <header
        className={[
          "sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out dark:border-slate-800/90 dark:bg-slate-950/80",
          shouldHideMobileChatChrome
            ? "pointer-events-none invisible h-0 -translate-y-1 overflow-hidden border-b-0 opacity-0 lg:pointer-events-auto lg:visible lg:h-auto lg:translate-y-0 lg:overflow-visible lg:border-b lg:opacity-100"
            : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8",
          ].join(" ")}
        >
          <Link
            to="/home"
            className="group flex min-w-0 items-center gap-3"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-[0_16px_34px_-20px_rgba(37,99,235,0.95)] ring-1 ring-blue-400/30 transition group-hover:scale-[1.03] dark:ring-blue-300/25">
              <img
                src="/favicon.svg"
                alt="Blog Pause 아이콘"
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                Blog Pause
              </span>
              <span className="hidden truncate text-[11px] font-medium text-slate-500 lg:block dark:text-slate-400">
                발견하고 기록하고, 바로 대화하는 블로그
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:flex dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-none">
            {resolvedMenuItems.map((item) => {
              const isActive = isMenuActive(item.path);
              const showChatUnreadBadge =
                isAuthenticated && item.path === "/chat" && unreadChatCount > 0;
              const requiresAuth =
                item.path === "/posts/create" ||
                item.path === "/chat" ||
                item.path === "/notifications" ||
                item.path === "/mypage";

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(event) => {
                    if (!requiresAuth || isAuthenticated) return;
                    event.preventDefault();
                    openLoginPrompt(item.path);
                  }}
                  onMouseEnter={() => {
                    if (item.path === "/posts/create" && isAuthenticated) {
                      void preloadCreateFlow();
                    }
                  }}
                  onFocus={() => {
                    if (item.path === "/posts/create" && isAuthenticated) {
                      void preloadCreateFlow();
                    }
                  }}
                  className={[
                    "relative rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-blue-600 text-white shadow-[0_18px_36px_-22px_rgba(37,99,235,0.92)] ring-1 ring-blue-500/35 dark:bg-blue-500 dark:text-white dark:ring-blue-300/30 dark:shadow-[0_18px_38px_-24px_rgba(37,99,235,0.75)]"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-950 dark:hover:text-slate-100",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {showChatUnreadBadge && (
                      <Badge
                        className={[
                          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                          isActive
                            ? "bg-white/20 text-white hover:bg-white/20 dark:bg-white/15 dark:text-white"
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

          <div className="hidden items-center gap-2 sm:gap-3 md:flex">
            <ThemeToggle className="rounded-xl" />
            <button
              type="button"
              onClick={openSpotlightSearch}
              title="검색 (⌘K / Ctrl+K)"
              aria-label="검색 열기"
              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="pointer-events-none absolute -bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700 [writing-mode:horizontal-tb]">
                검색
              </span>
            </button>

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <Link to={myBlogPath}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                  >
                    내 블로그
                  </Button>
                </Link>
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
              </>
            ) : isRestoringSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                확인 중
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/login", { state: currentPathWithSearchHash })}
                className="rounded-xl"
              >
                로그인
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle className="h-8 w-8 rounded-lg" />
            <button
              type="button"
              onClick={openSpotlightSearch}
              title="검색 (⌘K / Ctrl+K)"
              aria-label="검색 열기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>

            {isAuthenticated ? (
              <>
                <NotificationBell />
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
              </>
            ) : isRestoringSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                disabled
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/login", { state: currentPathWithSearchHash })}
                className="h-8 rounded-lg px-2.5 text-[11px]"
              >
                로그인
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        className={[
          "w-full",
          shouldHideMobileChatChrome
            ? "px-0 pt-0 pb-0 md:mx-auto md:max-w-7xl md:px-6 md:pt-6 md:pb-6 lg:px-8"
            : "mx-auto max-w-7xl px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-6 lg:px-8",
        ].join(" ")}
      >
        <div
          key={location.pathname}
          className={shouldUseRouteEnter ? "route-enter" : undefined}
        >
          {children}
        </div>
      </main>

      <CommandDialog open={isSpotlightOpen} onOpenChange={setIsSpotlightOpen}>
        <CommandInput
          value={spotlightSearchKeyword}
          onValueChange={setSpotlightSearchKeyword}
          placeholder="게시글 제목/본문 검색..."
        />
        <CommandList className="h-[min(60vh,520px)] max-h-[60vh]">
          <CommandEmpty>검색어를 입력하면 게시글 검색을 실행할 수 있습니다.</CommandEmpty>

          <CommandGroup heading="검색">
            <CommandItem
              disabled={normalizedSpotlightKeyword.length === 0}
              onSelect={() => applyFeedSearch(spotlightSearchKeyword)}
            >
              <Search className="h-4 w-4" />
              <span>
                "{normalizedSpotlightKeyword}" 게시글 검색
              </span>
              <CommandShortcut>Enter</CommandShortcut>
            </CommandItem>
            {activeFeedSearchKeyword ? (
              <CommandItem onSelect={() => applyFeedSearch("")}>
                <Search className="h-4 w-4" />
                <span>검색 초기화</span>
              </CommandItem>
            ) : null}
          </CommandGroup>

          {normalizedSpotlightKeyword.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="게시글 결과">
                {spotlightSearchQuery.isLoading ? (
                  <CommandItem disabled>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>검색 중...</span>
                  </CommandItem>
                ) : spotlightSearchQuery.error ? (
                  <CommandItem disabled>
                    <FileText className="h-4 w-4" />
                    <span>검색 결과를 불러오지 못했습니다.</span>
                  </CommandItem>
                ) : spotlightPosts.length > 0 ? (
                  spotlightPosts.map((post) => (
                    <CommandItem
                      key={`spotlight-post-${post.id}`}
                      value={`${post.title} ${post.subtitle ?? ""} ${post.excerpt ?? ""}`}
                      onSelect={() => {
                        navigate(resolvePostPath(post.id));
                        setIsSpotlightOpen(false);
                      }}
                      className="items-start"
                    >
                      <FileText className="mt-0.5 h-4 w-4" />
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {post.title}
                        </p>
                        {post.excerpt ? (
                          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {post.excerpt}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {(post.category?.name || "미분류")} · 조회{" "}
                          {post.viewCount.toLocaleString()}
                          {post.publishedAt || post.createdAt
                            ? ` · ${formatSpotlightDate(post.publishedAt || post.createdAt)}`
                            : ""}
                        </p>
                      </div>
                    </CommandItem>
                  ))
                ) : (
                  <CommandItem disabled>
                    <FileText className="h-4 w-4" />
                    <span>일치하는 게시글이 없습니다.</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          ) : null}

          <CommandSeparator />

          <CommandGroup heading="빠른 이동">
            <CommandItem
              onSelect={() => {
                navigate("/home");
                setIsSpotlightOpen(false);
              }}
            >
              <Home className="h-4 w-4" />
              <span>홈</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigate("/posts");
                setIsSpotlightOpen(false);
              }}
            >
              <Compass className="h-4 w-4" />
              <span>탐색</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigateWithAuth("/posts/create", true);
                setIsSpotlightOpen(false);
              }}
            >
              <PenSquare className="h-4 w-4" />
              <span>작성</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigateWithAuth("/chat", true);
                setIsSpotlightOpen(false);
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span>메시지</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigateWithAuth("/mypage", true);
                setIsSpotlightOpen(false);
              }}
            >
              <UserRound className="h-4 w-4" />
              <span>내 공간</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigateWithAuth("/notifications", true);
                setIsSpotlightOpen(false);
              }}
            >
              <Bell className="h-4 w-4" />
              <span>알림</span>
            </CommandItem>
            {isAdminUser ? (
              <CommandItem
                onSelect={() => {
                  navigate("/admin/dashboard");
                  setIsSpotlightOpen(false);
                }}
              >
                <FileText className="h-4 w-4" />
                <span>관리자 대시보드</span>
              </CommandItem>
            ) : null}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <ActionDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="로그인이 필요합니다"
        description="로그인 페이지로 이동하시겠습니까?"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        cancelText="나중에 로그인하기"
        confirmText="로그인 페이지 이동"
        onConfirm={() => {
          navigate("/login", { state: authIntentPath });
        }}
      />

      {shouldRenderMobileBottomNav && (
        <nav
          className={[
            "fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200/90 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out dark:border-slate-800/90 dark:bg-slate-950/95 md:hidden",
            shouldHideMobileChatChrome
              ? "pointer-events-none invisible translate-y-3 opacity-0"
              : "translate-y-0 opacity-100",
          ].join(" ")}
        >
          <div
            className="mx-auto grid max-w-md gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                visibleMobileBottomTabs.length,
                1,
              )}, minmax(0, 1fr))`,
            }}
          >
            {visibleMobileBottomTabs.map((tab) => {
              const isActive = isMenuActive(tab.path);
              const Icon = tab.icon;
              const badgeCount =
                tab.badgeType === "chat"
                    ? unreadChatCount
                    : 0;
              const showUnreadBadge = badgeCount > 0;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  onClick={(event) => {
                    if (!tab.requiresAuth || isAuthenticated) return;
                    event.preventDefault();
                    openLoginPrompt(tab.path);
                  }}
                  className={[
                    "relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition",
                    isActive
                      ? "bg-blue-600 text-white shadow-[0_20px_40px_-28px_rgba(37,99,235,0.92)] ring-1 ring-blue-500/35 dark:bg-blue-500 dark:text-white dark:ring-blue-300/30"
                      : "bg-slate-100/95 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
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
