import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Progress } from "@/components/ui";
import { readCurationPostIds } from "@/features/post/utils/curationStorage";
import Button from "@/shared/ui/Button";
import SegmentedControl from "@/shared/ui/SegmentedControl";
import type { AdminCommentRow, AdminDashboardSummary, AdminPostRow } from "../types";
import { useAdminDashboardActivity, useAdminModerationStats } from "../queries";

type Props = {
  summary: AdminDashboardSummary;
};

type ActivityChartMode = "area" | "line" | "bar";

type ActivityPoint = {
  key: string;
  label: string;
  posts: number;
  comments: number;
  total: number;
};

type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

type ModerationPanelProps = {
  label: string;
  hidden: number;
  total: number;
  ratio: number;
  accentClassName: string;
  progressClassName: string;
};

const ACTIVITY_MODE_OPTIONS: Array<{ value: ActivityChartMode; label: string }> = [
  { value: "area", label: "흐름" },
  { value: "line", label: "추세" },
  { value: "bar", label: "비교" },
];

const DISTRIBUTION_COLORS = ["#2b6ef3", "#06b6d4", "#0f9d7a", "#f59e0b", "#8b5cf6"];
const NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

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

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.round(value);
}

function getTrendMeta(delta: number) {
  if (delta > 0) {
    return {
      icon: ArrowUpRight,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
      label: `전일 대비 ${formatNumber(delta)}건 증가`,
    };
  }

  if (delta < 0) {
    return {
      icon: ArrowDownRight,
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
      label: `전일 대비 ${formatNumber(Math.abs(delta))}건 감소`,
    };
  }

  return {
    icon: Minus,
    className:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    label: "전일과 동일",
  };
}

function getModerationState(ratio: number) {
  if (ratio >= 35) return "확인 필요";
  if (ratio >= 15) return "주의";
  return "안정";
}

function InsightMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/78 px-4 py-3 shadow-[0_18px_38px_-28px_rgba(37,99,235,0.45)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/40 dark:shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function ModerationPanel({
  label,
  hidden,
  total,
  ratio,
  accentClassName,
  progressClassName,
}: ModerationPanelProps) {
  const cleanCount = Math.max(total - hidden, 0);
  const state = getModerationState(ratio);

  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)] dark:border-slate-800/80 dark:bg-slate-950/35 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            숨김 {formatNumber(hidden)}건 / 전체 {formatNumber(total)}건
          </p>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            accentClassName,
          ].join(" ")}
        >
          {state}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">숨김 비율</span>
          <span className="font-black text-slate-950 dark:text-slate-100">
            {ratio}%
          </span>
        </div>
        <Progress
          value={ratio}
          className={[
            "h-2.5 bg-slate-200/80 dark:bg-slate-800 [&>div]:transition-all [&>div]:duration-500",
            progressClassName,
          ].join(" ")}
          aria-label={`${label} 숨김 비율`}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            정상
          </p>
          <p className="mt-1 font-black text-slate-900 dark:text-slate-100">
            {formatNumber(cleanCount)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            숨김
          </p>
          <p className="mt-1 font-black text-slate-900 dark:text-slate-100">
            {formatNumber(hidden)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardCharts({ summary }: Props) {
  const [activityMode, setActivityMode] = useState<ActivityChartMode>("area");
  const [curationCount, setCurationCount] = useState(0);
  const activityQuery = useAdminDashboardActivity();
  const moderationQuery = useAdminModerationStats();

  useEffect(() => {
    const syncCurationCount = () => {
      setCurationCount(readCurationPostIds().length);
    };

    syncCurationCount();
    window.addEventListener("focus", syncCurationCount);
    return () => {
      window.removeEventListener("focus", syncCurationCount);
    };
  }, []);

  const distributionData = useMemo<DistributionItem[]>(
    () =>
      [
        { name: "사용자", value: summary.totalUsers, color: DISTRIBUTION_COLORS[0] },
        { name: "게시글", value: summary.totalPosts, color: DISTRIBUTION_COLORS[1] },
        { name: "댓글", value: summary.totalComments, color: DISTRIBUTION_COLORS[2] },
        {
          name: "대화방",
          value: summary.totalConversations,
          color: DISTRIBUTION_COLORS[3],
        },
        {
          name: "알림",
          value: summary.totalNotifications,
          color: DISTRIBUTION_COLORS[4],
        },
      ].sort((left, right) => right.value - left.value),
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

  const activityTotals = useMemo(() => {
    const totalPosts = activityData.reduce((sum, item) => sum + item.posts, 0);
    const totalComments = activityData.reduce((sum, item) => sum + item.comments, 0);
    const totalActions = totalPosts + totalComments;
    const today = activityData.at(-1) ?? {
      key: "",
      label: "-",
      posts: 0,
      comments: 0,
      total: 0,
    };
    const previous = activityData.at(-2) ?? today;
    const peak =
      activityData.reduce<ActivityPoint | null>((best, item) => {
        if (!best || item.total > best.total) return item;
        return best;
      }, null) ?? today;

    return {
      totalPosts,
      totalComments,
      totalActions,
      today,
      previous,
      peak,
      averageDaily: activityData.length > 0 ? Math.round(totalActions / activityData.length) : 0,
    };
  }, [activityData]);

  const trendMeta = getTrendMeta(activityTotals.today.total - activityTotals.previous.total);
  const TrendIcon = trendMeta.icon;

  const distributionTotal = useMemo(
    () => distributionData.reduce((sum, item) => sum + item.value, 0),
    [distributionData],
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
  const highestRiskRatio = Math.max(postHiddenRatio, commentHiddenRatio);

  const chartTooltipStyle = {
    borderRadius: "18px",
    border: "1px solid rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.96)",
    boxShadow: "0 20px 50px -30px rgba(15,23,42,0.45)",
    padding: "10px 12px",
  };

  const activityChart = (() => {
    if (activityMode === "line") {
      return (
        <LineChart data={activityData} margin={{ top: 16, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.18} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            stroke="#94a3b8"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={28}
            stroke="#94a3b8"
          />
          <Tooltip
            cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
            contentStyle={chartTooltipStyle}
            formatter={(value: number, name: string) => [formatNumber(value), name]}
            labelFormatter={(label) => `${label}`}
          />
          <Line
            type="monotone"
            dataKey="posts"
            name="게시글"
            stroke="#2b6ef3"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: "#2b6ef3" }}
          />
          <Line
            type="monotone"
            dataKey="comments"
            name="댓글"
            stroke="#0f9d7a"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: "#0f9d7a" }}
          />
        </LineChart>
      );
    }

    if (activityMode === "bar") {
      return (
        <BarChart data={activityData} margin={{ top: 16, right: 10, left: -12, bottom: 0 }} barGap={10}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.18} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            stroke="#94a3b8"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={28}
            stroke="#94a3b8"
          />
          <Tooltip
            cursor={{ fill: "rgba(191,219,254,0.24)" }}
            contentStyle={chartTooltipStyle}
            formatter={(value: number, name: string) => [formatNumber(value), name]}
            labelFormatter={(label) => `${label}`}
          />
          <Bar
            dataKey="posts"
            name="게시글"
            fill="#2b6ef3"
            radius={[10, 10, 4, 4]}
            maxBarSize={20}
          />
          <Bar
            dataKey="comments"
            name="댓글"
            fill="#0f9d7a"
            radius={[10, 10, 4, 4]}
            maxBarSize={20}
          />
        </BarChart>
      );
    }

    return (
      <AreaChart data={activityData} margin={{ top: 16, right: 10, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="admin-posts-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2b6ef3" stopOpacity={0.34} />
            <stop offset="95%" stopColor="#2b6ef3" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="admin-comments-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f9d7a" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#0f9d7a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.18} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          stroke="#94a3b8"
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={28}
          stroke="#94a3b8"
        />
        <Tooltip
          cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
          contentStyle={chartTooltipStyle}
          formatter={(value: number, name: string) => [formatNumber(value), name]}
          labelFormatter={(label) => `${label}`}
        />
        <Area
          type="monotone"
          dataKey="posts"
          name="게시글"
          stroke="#2b6ef3"
          strokeWidth={2.75}
          fill="url(#admin-posts-fill)"
          activeDot={{ r: 5, fill: "#2b6ef3" }}
        />
        <Area
          type="monotone"
          dataKey="comments"
          name="댓글"
          stroke="#0f9d7a"
          strokeWidth={2.75}
          fill="url(#admin-comments-fill)"
          activeDot={{ r: 5, fill: "#0f9d7a" }}
        />
      </AreaChart>
    );
  })();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98)_40%,rgba(236,253,245,0.82))] p-5 shadow-[0_32px_100px_-70px_rgba(37,99,235,0.55)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92),rgba(15,23,42,0.98))] dark:ring-slate-800/70">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">
              <Activity className="h-3.5 w-3.5" />
              Activity Pulse
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                최근 7일 운영 흐름
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                게시글과 댓글 생성량을 한 화면에서 보고, 급증 구간을 빠르게 잡습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                  trendMeta.className,
                ].join(" ")}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {trendMeta.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                평균 {formatNumber(activityTotals.averageDaily)}건 / 일
              </span>
            </div>
          </div>

          <SegmentedControl<ActivityChartMode>
            value={activityMode}
            onChange={setActivityMode}
            options={ACTIVITY_MODE_OPTIONS}
            className="sm:min-w-[252px]"
            buttonClassName="min-w-0 flex-1 sm:min-w-[78px]"
          />
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InsightMetric
            label="이번 주 액션"
            value={formatNumber(activityTotals.totalActions)}
            hint={`게시글 ${formatNumber(activityTotals.totalPosts)} · 댓글 ${formatNumber(activityTotals.totalComments)}`}
          />
          <InsightMetric
            label="오늘 생성"
            value={formatNumber(activityTotals.today.total)}
            hint={`게시글 ${formatNumber(activityTotals.today.posts)} · 댓글 ${formatNumber(activityTotals.today.comments)}`}
          />
          <InsightMetric
            label="피크 데이"
            value={activityTotals.peak.label}
            hint={`${formatNumber(activityTotals.peak.total)}건으로 최고치`}
          />
        </div>

        <div className="mt-5 rounded-[28px] border border-white/80 bg-white/86 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/40">
          {activityQuery.isLoading ? (
            <div className="h-[320px] animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/70" />
          ) : activityQuery.isError ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
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
	            <>
	              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  {activityChart}
                </ResponsiveContainer>
              </div>
	              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
	                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2b6ef3]" />
                  게시글 {formatNumber(activityTotals.totalPosts)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0f9d7a]" />
                  댓글 {formatNumber(activityTotals.totalComments)}
                </span>
	                <span className="text-slate-400">피크 {activityTotals.peak.label}</span>
	              </div>

                <section className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Action Center
                      </p>
                      <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">
                        운영 액션 센터
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        차트에서 본 흐름을 바로 운영 액션으로 연결할 수 있게 정리했습니다.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
                      오늘 액션 {formatNumber(activityTotals.today.total)}건
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        검수 대기
                      </p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                        {formatNumber((moderationStats?.postsHidden ?? 0) + (moderationStats?.commentsHidden ?? 0))}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        숨김 게시글 {formatNumber(moderationStats?.postsHidden ?? 0)}건, 숨김 댓글 {formatNumber(moderationStats?.commentsHidden ?? 0)}건
                      </p>
                      <Link
                        to="/admin/comments"
                        className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        댓글 검수로 이동
                      </Link>
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        홈 추천 슬롯
                      </p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                        {formatNumber(curationCount)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        현재 홈 오늘의 추천에 연결된 운영자 추천 슬롯 수입니다.
                      </p>
                      <Link
                        to="/admin/curation"
                        className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        추천/검수 편집하기
                      </Link>
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        빠른 이동
                      </p>
                      <p className="mt-2 text-sm font-black tracking-tight text-slate-950 dark:text-slate-50">
                        지금 바로 처리할 운영 작업
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link to="/admin/posts">
                          <Button type="button" variant="outline" size="sm">
                            게시글 관리
                          </Button>
                        </Link>
                        <Link to="/admin/comments">
                          <Button type="button" variant="outline" size="sm">
                            댓글 관리
                          </Button>
                        </Link>
                        <Link to="/admin/curation">
                          <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                            추천 편집
                          </Button>
                        </Link>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        최고 리스크 {highestRiskRatio}% 구간을 먼저 확인하는 게 좋습니다.
                      </p>
                    </div>
                  </div>
                </section>
	            </>
	          )}
	        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.52)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
          <header className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <Sparkles className="h-3.5 w-3.5" />
                Mix
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                운영 자산 구성
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                어떤 리소스가 현재 운영 볼륨을 가장 많이 차지하는지 보여줍니다.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Total
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                {formatNumber(distributionTotal)}
              </p>
            </div>
          </header>

          <ul className="mt-5 space-y-3">
            {distributionData.map((entry, index) => {
              const share = distributionTotal > 0 ? (entry.value / distributionTotal) * 100 : 0;
              return (
                <li
                  key={entry.name}
                  className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800/80 dark:bg-slate-950/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-black text-white shadow-sm"
                        style={{ backgroundColor: entry.color }}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {entry.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          비중 {share.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">
                      {formatNumber(entry.value)}
                    </p>
                  </div>

                  <div className="mt-3 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(share, entry.value > 0 ? 8 : 0)}%`,
                        backgroundColor: entry.color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.52)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
          <header className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {highestRiskRatio >= 15 ? (
                  <ShieldAlert className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Moderation
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                운영 건강도
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                숨김 비율이 높아지는지 빠르게 점검합니다.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              최고 리스크 {highestRiskRatio}%
            </span>
          </header>

          {moderationQuery.isLoading ? (
            <div className="mt-5 grid gap-3">
              <div className="h-40 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/70" />
              <div className="h-40 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ) : moderationQuery.isError ? (
            <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
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
            <div className="mt-5 grid gap-3">
              <ModerationPanel
                label="게시글 상태"
                hidden={moderationStats?.postsHidden ?? 0}
                total={postsTotal}
                ratio={postHiddenRatio}
                accentClassName="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
                progressClassName="[&>div]:bg-rose-500"
              />
              <ModerationPanel
                label="댓글 상태"
                hidden={moderationStats?.commentsHidden ?? 0}
                total={commentsTotal}
                ratio={commentHiddenRatio}
                accentClassName="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                progressClassName="[&>div]:bg-amber-500"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
