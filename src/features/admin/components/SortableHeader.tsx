import type { ReactNode } from "react";

type SortableHeaderProps = {
  label: ReactNode;
  field: string;
  currentField: string;
  direction: "asc" | "desc";
  onToggle: (field: string) => void;
};

export default function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onToggle,
}: SortableHeaderProps) {
  const active = currentField === field;
  const indicator = active ? (direction === "asc" ? "▲" : "▼") : "";

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-1 text-left text-xs font-semibold tracking-tight text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      aria-label={`${String(label)} 정렬 변경`}
    >
      <span>{label}</span>
      <span className="min-w-3 text-[10px]">{indicator}</span>
    </button>
  );
}
