import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Progress } from "@/components/ui";
import Button from "@/shared/ui/Button";
import SegmentedControl from "@/shared/ui/SegmentedControl";
import type { AdminCommentRow, AdminDashboardSummary, AdminPostRow } from "../types";
import { useAdminDashboardActivity, useAdminModerationStats } from "../queries";

type Props = {
  summary: AdminDashboardSummary;
};

type ActivityChartMode = "bar" | "line" | "area";

type ActivityPoint = {
  key: string;
  label: string;
  posts: number;
  comments: number;
  total: number;
};

const ACTIVITY_MODE_OPTIONS: Array<{ value: ActivityChartMode; label: string }> = [
  { value: "bar", label: "막대" },
  { value: "line", label: "선" },
  { value: "area", label: "영역" },
];

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#6366f1"];

function toDayKey(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getActivitySeries(
  posts: AdminPostRow[] = [],
  comments: AdminCommentRow[] = [],
): ActivityPoint[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const baseDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    });
    return { key, label, posts: 0, comments: 0, total: 0 };
  });

  const map = new Map(baseDays.map((item) => [item.key, item]));

  for (const post of posts) {
    const key = toDayKey(post.createdAt);
    if (!key) continue;
    const target = map.get(key);
    if (!target) continue;
    target.posts += 1;
    target.total += 1;
  }

  for (const comment of comments) {
    const key = toDayKey(comment.createdAt);
    if (!key) continue;
    const target = map.get(key);
    if (!target) continue;
    target.comments += 1;
    target.total += 1;
  }

  return baseDays;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.round(value);
}

export default function AdminDashboardCharts({ summary }: Props) {
  const [activityMode, setActivityMode] = useState<ActivityChartMode>("bar");
  const activityQuery = useAdminDashboardActivity();
  const moderationQuery = useAdminModerationStats();

  const distributionData = useMemo(
    () => [
      { name: "사용자", value: summary.totalUsers },
      { name: "게시글", value: summary.totalPosts },
      { name: "댓글", value: summary.totalComments },
      { name: "대화방", value: summary.totalConversations },
      { name: "알림", value: summary.totalNotifications },
    ],
    [summary],
  );

  const activityData = useMemo(
    () =>
      getActivitySeries(
        activityQuery.data?.posts.content,
        activityQuery.data?.comments.content,
      ),
    [activityQuery.data?.comments.content, activityQuery.data?.posts.content],
  );

  const moderationStats = moderationQuery.data;
  const postsTotal =
    (moderationStats?.postsHidden ?? 0) + (moderationStats?.postsNormal ?? 0);
  const commentsTotal =
    (moderationStats?.commentsHidden ?? 0) + (moderationStats?.commentsNormal ?? 0);
  const postHiddenRatio = formatPercent(
    postsTotal > 0 ? ((moderationStats?.postsHidden ?? 0) / postsTotal) * 100 : 0,
  );
  const commentHiddenRatio = formatPercent(
    commentsTotal > 0
      ? ((moderationStats?.commentsHidden ?? 0) / commentsTotal) * 100
      : 0,
  );

  const tooltipCursor =
    activityMode === "bar"
      ? { fill: "rgba(37,99,235,0.08)" }
      : { stroke: "#93c5fd", strokeWidth: 1 };

  const tooltipStyle = {
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.25)",
    backgroundColor: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 24px -16px rgba(15,23,42,0.45)",
  };

  const activityChart = (() => {
    if (activityMode === "line") {
      return (
        <LineChart data={activityData}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.25} />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip
            cursor={tooltipCursor}
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 700 }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="posts"
            name="게시글"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="comments"
            name="댓글"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      );
    }

    if (activityMode === "area") {
      return (
        <AreaChart data={activityData}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip
            cursor={tooltipCursor}
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 700 }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="posts"
            name="게시글"
            stroke="#2563eb"
            fill="#93c5fd"
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="comments"
            name="댓글"
            stroke="#f97316"
            fill="#fdba74"
            fillOpacity={0.45}
          />
        </AreaChart>
      );
    }

    return (
      <BarChart data={activityData}>
        <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip
          cursor={tooltipCursor}
          contentStyle={tooltipStyle}
          labelStyle={{ fontWeight: 700 }}
        />
        <Legend />
        <Bar dataKey="posts" name="게시글" fill="#2563eb" radius={[6, 6, 0, 0]} />
        <Bar
          dataKey="comments"
          name="댓글"
          fill="#f97316"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    );
  })();

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900 xl:col-span-2">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              활동 현황
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              최근 7일 게시글/댓글 추이
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              차트 타입을 바꿔서 동일 데이터를 다른 관점으로 볼 수 있습니다.
            </p>
          </div>
          <SegmentedControl<ActivityChartMode>
            value={activityMode}
            onChange={setActivityMode}
            options={ACTIVITY_MODE_OPTIONS}
            className="w-full bg-slate-100/90 sm:w-auto"
            buttonClassName="min-w-0 flex-1 sm:min-w-[76px]"
          />
        </header>

        {activityQuery.isLoading ? (
          <div className="h-[280px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
        ) : activityQuery.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
                  활동 차트를 불러오지 못했습니다.
                </p>
                <p className="mt-1 text-xs text-rose-700/90 dark:text-rose-200/90">
                  {activityQuery.error.message}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => activityQuery.refetch()}
                  aria-label="활동 차트 다시 시도"
                >
                  다시 시도
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {activityChart}
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
        <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              분포
            </p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            리소스 분포
          </h2>
        </header>

        <div className="h-[200px] sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={3}
              >
                {distributionData.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${entry.value}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ fontWeight: 700 }}
                cursor={false}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-2">
          {distributionData.map((entry, index) => (
            <li
              key={entry.name}
              className="flex items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 text-sm dark:border-slate-700/70"
            >
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                {entry.name}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {entry.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900 xl:col-span-3">
        <header className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              운영 상태
            </p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            운영 상태 Progress
          </h2>
        </header>

        {moderationQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
        ) : moderationQuery.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
              운영 지표를 불러오지 못했습니다.
            </p>
            <p className="mt-1 text-xs text-rose-700/90 dark:text-rose-200/90">
              {moderationQuery.error.message}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => moderationQuery.refetch()}
              aria-label="운영 지표 다시 시도"
            >
              다시 시도
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 p-4 dark:border-slate-700/70">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  게시글 숨김 비율
                </p>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {postHiddenRatio}%
                </span>
              </div>
              <Progress
                value={postHiddenRatio}
                className="h-2.5 bg-slate-200 dark:bg-slate-800 [&>div]:bg-rose-500"
                aria-label="게시글 숨김 비율"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                숨김 {(moderationStats?.postsHidden ?? 0).toLocaleString()} / 전체{" "}
                {postsTotal.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 p-4 dark:border-slate-700/70">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  댓글 숨김 비율
                </p>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {commentHiddenRatio}%
                </span>
              </div>
              <Progress
                value={commentHiddenRatio}
                className="h-2.5 bg-slate-200 dark:bg-slate-800 [&>div]:bg-amber-500"
                aria-label="댓글 숨김 비율"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                숨김 {(moderationStats?.commentsHidden ?? 0).toLocaleString()} / 전체{" "}
                {commentsTotal.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
