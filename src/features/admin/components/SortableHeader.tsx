import type { ReactNode } from "react";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
  const Indicator = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-1 text-left text-[11px] font-semibold tracking-[0.14em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      aria-label={`${String(label)} 정렬 변경`}
    >
      <span>{label}</span>
      <Indicator
        className={[
          "h-3.5 w-3.5 shrink-0",
          active
            ? "text-blue-600 dark:text-blue-300"
            : "text-slate-400 dark:text-slate-500",
        ].join(" ")}
      />
    </button>
  );
}
