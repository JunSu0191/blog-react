import type { ReactNode } from "react";

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
    <div className={["inline-grid rounded-xl bg-slate-100 p-1", className ?? ""].join(" ")}>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
                buttonClassName ?? "",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
