import { AlertTriangle } from "lucide-react";
import AdminShell from "../components/AdminShell";
import AdminDashboardCharts from "../components/AdminDashboardCharts";
import AdminRecentCommentsPreview from "../components/AdminRecentCommentsPreview";
import AdminRecentPostsPreview from "../components/AdminRecentPostsPreview";
import { useAdminDashboardSummary } from "../queries";
import { StatCard } from "@/shared/ui";

export default function AdminDashboardPage() {
  const summaryQuery = useAdminDashboardSummary();
  const summaryData = summaryQuery.data ?? {
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    totalConversations: 0,
    totalNotifications: 0,
  };

  return (
    <AdminShell
      title="관리자 대시보드"
      description="핵심 지표를 한눈에 보고 관리자 액션 이후 상태를 확인합니다."
    >
      <div className="space-y-6">
        {summaryQuery.isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            대시보드 데이터를 불러오는 중...
          </div>
        ) : summaryQuery.isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/25">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  대시보드 데이터를 불러오지 못했습니다.
                </p>
                <p className="mt-1 text-xs text-rose-700/90 dark:text-rose-300/90">
                  {summaryQuery.error.message}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="총 사용자"
                value={summaryData.totalUsers}
                tone="info"
              />
              <StatCard
                label="총 게시글"
                value={summaryData.totalPosts}
                tone="default"
              />
              <StatCard
                label="총 댓글"
                value={summaryData.totalComments}
                tone="success"
              />
              <StatCard
                label="총 대화방"
                value={summaryData.totalConversations}
                tone="warning"
              />
              <StatCard
                label="총 알림"
                value={summaryData.totalNotifications}
                tone="info"
              />
            </section>
            <AdminDashboardCharts summary={summaryData} />
          </>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminRecentPostsPreview />
          <AdminRecentCommentsPreview />
        </div>
      </div>
    </AdminShell>
  );
}
