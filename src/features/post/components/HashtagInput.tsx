import { type KeyboardEvent, useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/cn";
import { TagChip } from "@/shared/ui";

type HashtagInputProps = {
  label?: string;
  tags: string[];
  value: string;
  onValueChange: (nextValue: string) => void;
  onCommit: (value: string) => boolean;
  onRemove: (tag: string) => void;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
};

export default function HashtagInput({
  label,
  tags,
  value,
  onValueChange,
  onCommit,
  onRemove,
  hint,
  error,
  disabled,
}: HashtagInputProps) {
  const inputId = useId();
  const suppressNextBlurCommit = useRef(false);
  const isComposingRef = useRef(false);
  const [message, setMessage] = useState("");
  const describedBy = error
    ? `${inputId}-error`
    : message
      ? `${inputId}-message`
      : hint
        ? `${inputId}-hint`
        : undefined;

  const handleCommit = (nextValue: string) => {
    const trimmedValue = nextValue.trim();
    if (!trimmedValue) return false;

    suppressNextBlurCommit.current = true;
    const added = onCommit(trimmedValue);
    if (added) {
      setMessage("");
    } else {
      setMessage("이미 등록된 태그입니다.");
    }
    return added;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !value.trim() && tags.length > 0) {
      event.preventDefault();
      onRemove(tags[tags.length - 1]);
      return;
    }

    if (isComposingRef.current) return;

    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    handleCommit(value);
  };

  const handleBlur = () => {
    if (suppressNextBlurCommit.current) {
      suppressNextBlurCommit.current = false;
      return;
    }
    handleCommit(value);
  };

  const handleChange = (nextValue: string) => {
    suppressNextBlurCommit.current = false;
    if (message) setMessage("");
    onValueChange(nextValue);
  };

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

      <div
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition-colors",
          "bg-slate-50/90 dark:bg-slate-900/85",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100/90 opacity-70 dark:border-slate-700 dark:bg-slate-900/70"
            : error
              ? "border-rose-500 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 dark:border-rose-500"
              : "border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700",
        )}
      >
        {tags.map((tag) => (
          <TagChip
            key={tag}
            label={tag}
            onRemove={() => {
              onRemove(tag);
            }}
            removeDisabled={disabled}
          />
        ))}
        <div className="relative min-w-[140px] flex-1 rounded-full border border-dashed border-slate-300/90 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 dark:text-slate-500">
            #
          </span>
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            placeholder="태그 입력"
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            className="h-6 w-full rounded-full border-0 bg-transparent pl-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {!error && (message || hint) ? (
        <p
          id={`${inputId}-${message ? "message" : "hint"}`}
          className={`mt-1 text-sm ${
            message ? "text-amber-600 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {message || hint}
        </p>
      ) : null}
    </div>
  );
}
