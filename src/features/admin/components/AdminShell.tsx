import type { ReactNode } from "react";
import {
  FileText,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/cn";

type AdminShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const adminNavItems = [
  {
    label: "대시보드",
    path: "/admin/dashboard",
    description: "운영 지표",
    icon: LayoutDashboard,
  },
  {
    label: "사용자",
    path: "/admin/users",
    description: "계정 관리",
    icon: Users,
  },
  {
    label: "게시글",
    path: "/admin/posts",
    description: "콘텐츠 관리",
    icon: FileText,
  },
  {
    label: "댓글",
    path: "/admin/comments",
    description: "커뮤니티 관리",
    icon: MessageSquare,
  },
];

function isActivePath(currentPath: string, targetPath: string) {
  if (currentPath === targetPath) return true;
  return currentPath.startsWith(`${targetPath}/`);
}

export default function AdminShell({
  title,
  description,
  actions,
  children,
}: AdminShellProps) {
  const location = useLocation();

  return (
    <div className="route-enter">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                관리자 콘솔
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                운영 메뉴
              </p>
            </div>

            <nav
              className="grid grid-cols-2 gap-2 p-3 lg:block lg:space-y-2"
              aria-label="관리자 탭 네비게이션"
            >
              {adminNavItems.map((item) => {
                const active = isActivePath(location.pathname, item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "group flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 transition",
                      active
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition",
                        active
                          ? "border-blue-200 bg-white text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300"
                          : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex min-w-0 flex-col text-left">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200/80 px-4 py-4 dark:border-slate-700/80 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    관리자 작업공간
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {description}
                    </p>
                  )}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
              </div>
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
