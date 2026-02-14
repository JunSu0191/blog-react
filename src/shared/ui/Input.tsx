import { useId, type InputHTMLAttributes } from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
};

export default function Input({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <Label
          htmlFor={inputId}
          className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
        </Label>
      )}
      <ShadcnInput
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "h-11 rounded-xl border-slate-200 bg-white/95 px-3 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:placeholder:text-slate-500",
          error
            ? "border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/20 dark:border-rose-500"
            : "focus-visible:border-blue-500 dark:focus-visible:border-blue-400",
          className,
        )}
        style={{ textTransform: "none" }}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
