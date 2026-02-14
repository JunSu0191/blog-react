import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/shared/lib/cn";

type StatTone = "default" | "info" | "success" | "warning";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
};

const toneClasses: Record<StatTone, string> = {
  default:
    "border-blue-100/80 bg-blue-50/70 dark:border-slate-700 dark:bg-slate-800/80",
  info:
    "border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/30",
  success:
    "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  warning:
    "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30",
};

const labelToneClasses: Record<StatTone, string> = {
  default: "text-blue-700/90 dark:text-blue-300",
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
};

export default function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl px-4 py-3 shadow-none",
        toneClasses[tone],
        className,
      )}
    >
      <p className={cn("text-xs font-semibold", labelToneClasses[tone])}>{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}
