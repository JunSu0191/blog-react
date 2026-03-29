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
        "relative grid w-full gap-1 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-slate-700/90 dark:bg-slate-800/90 dark:shadow-none sm:w-auto",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${optionCount}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-white shadow-[0_10px_26px_-18px_rgba(15,23,42,0.45)] transition-transform duration-300 ease-out dark:bg-slate-900 dark:shadow-[0_14px_28px_-18px_rgba(2,6,23,0.82)]"
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
            "relative z-10 min-w-0 flex-1 whitespace-nowrap rounded-lg border border-transparent px-2 py-2 text-center text-[11px] font-semibold leading-none text-slate-500 transition-colors duration-200 hover:text-slate-700 data-[state=on]:border-transparent data-[state=on]:bg-transparent data-[state=on]:text-slate-900 data-[state=on]:shadow-none dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=on]:border-transparent dark:data-[state=on]:bg-transparent dark:data-[state=on]:text-slate-100 sm:min-w-[84px] sm:px-3 sm:text-[13px]",
            buttonClassName,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
