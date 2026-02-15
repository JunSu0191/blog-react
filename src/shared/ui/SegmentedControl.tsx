import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/shared/lib/cn";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string = string> = {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
};

export default function SegmentedControl<T extends string = string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: SegmentedControlProps<T>) {
  const optionCount = Math.max(options.length, 1);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const gapRem = 0.25;
  const totalHorizontalPaddingRem = 0.5;
  const totalGapRem = Math.max(0, optionCount - 1) * gapRem;

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue as T);
        }
      }}
      className={cn(
        "relative inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/80",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-lg bg-white shadow-[0_10px_22px_-16px_rgba(15,23,42,0.55)] transition-transform duration-300 ease-out dark:bg-slate-900 dark:shadow-[0_14px_24px_-18px_rgba(2,6,23,0.9)]"
        style={{
          width: `calc((100% - ${totalHorizontalPaddingRem}rem - ${totalGapRem}rem) / ${optionCount})`,
          transform: `translateX(calc(${activeIndex} * (100% + ${gapRem}rem)))`,
        }}
      />
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          variant="default"
          size="sm"
          className={cn(
            "relative z-10 min-w-[84px] flex-1 rounded-lg border border-transparent px-3 text-sm font-semibold text-slate-500 hover:text-slate-700 data-[state=on]:border-transparent data-[state=on]:bg-transparent data-[state=on]:text-blue-700 data-[state=on]:shadow-none dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=on]:border-transparent dark:data-[state=on]:bg-transparent dark:data-[state=on]:text-blue-300",
            buttonClassName,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
