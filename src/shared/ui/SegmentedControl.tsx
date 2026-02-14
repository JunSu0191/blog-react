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
        "inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/80",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          variant="default"
          size="sm"
          className={cn(
            "rounded-lg border border-transparent px-3 text-sm font-semibold text-slate-500 hover:text-slate-700 data-[state=on]:border-slate-200 data-[state=on]:bg-white data-[state=on]:text-blue-700 data-[state=on]:shadow-sm dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=on]:border-slate-700 dark:data-[state=on]:bg-slate-900 dark:data-[state=on]:text-blue-300",
            buttonClassName,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
