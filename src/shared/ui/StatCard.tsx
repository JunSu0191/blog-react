import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
};

export default function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div className={["rounded-2xl bg-blue-50/60 px-4 py-3", className ?? ""].join(" ")}>
      <p className="text-xs font-semibold text-blue-700/80">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
