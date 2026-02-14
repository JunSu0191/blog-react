import React from "react";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string | number; label: string }>;
};

export default function Select({
  label,
  error,
  hint,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${Math.random}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-4 py-2.5 text-base
          bg-white border border-slate-200
          rounded-lg
          transition-all duration-200
          focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
          hover:border-slate-300
          disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200
          appearance-none
          cursor-pointer
          ${
            error
              ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
              : ""
          }
          ${className ?? ""}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
