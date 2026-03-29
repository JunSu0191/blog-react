import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type TagChipProps = {
  label: string;
  count?: number;
  className?: string;
  onRemove?: () => void;
  removeLabel?: string;
  removeDisabled?: boolean;
};

export default function TagChip({
  label,
  count,
  className,
  onRemove,
  removeLabel,
  removeDisabled = false,
}: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border-0 bg-[#f2f4f6] px-3 py-[6px] text-[13px] font-medium text-[#4e5968] transition-colors duration-150 ease-in-out hover:bg-[#e9edf2]",
        "dark:bg-[#2c3440] dark:text-[#c5cfdb] dark:hover:bg-[#36404f]",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-[#677489] dark:text-[#a7b5c8]">#</span>
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#4e5968] dark:bg-[#202833] dark:text-[#d2dbe6]">
          {count}
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? `태그 ${label} 삭제`}
          onClick={onRemove}
          disabled={removeDisabled}
          className="inline-flex h-4 w-4 items-center justify-center rounded-[6px] text-[#7a879a] transition-colors duration-150 ease-in-out hover:bg-white/70 hover:text-[#4e5968] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#a7b5c8] dark:hover:bg-[#1f2833] dark:hover:text-[#dbe4ef]"
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}
