import {
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from "react";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/cn";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  options: Array<{ value: string | number; label: string }>;
};

export default function Select({
  label,
  error,
  hint,
  options,
  className,
  id,
  value,
  defaultValue,
  onChange,
  onValueChange,
  disabled,
  name,
  placeholder,
  required,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const isControlled = value !== undefined;
  const normalizedDefaultValue = useMemo(() => {
    if (defaultValue === undefined || defaultValue === null) return "";
    return String(defaultValue);
  }, [defaultValue]);
  const [internalValue, setInternalValue] = useState(normalizedDefaultValue);
  const currentValue =
    value === undefined || value === null ? internalValue : String(value);
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  const handleValueChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
    onChange?.({
      target: { value: nextValue, name } as EventTarget & HTMLSelectElement,
      currentTarget: { value: nextValue, name } as EventTarget & HTMLSelectElement,
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className="w-full">
      {label && (
        <Label
          htmlFor={selectId}
          className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
        </Label>
      )}
      <ShadcnSelect
        value={currentValue || undefined}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "h-11 rounded-xl border-slate-200 bg-white/95 text-sm text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100",
            error
              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500"
              : "focus:border-blue-500 dark:focus:border-blue-400",
            className,
          )}
        >
          <SelectValue placeholder={placeholder || "선택하세요"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
      {error && (
        <p id={`${selectId}-error`} className="mt-1 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${selectId}-hint`} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
