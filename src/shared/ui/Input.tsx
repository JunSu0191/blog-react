import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
  const inputId = id || `input-${Math.random}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-4 py-2.5 text-base
          bg-white border border-slate-200
          rounded-lg
          transition-all duration-200
          focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
          hover:border-slate-300
          placeholder:text-slate-400
          disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200
          ${
            error
              ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
              : ""
          }
          ${className ?? ""}
        `}
        style={{ textTransform: "none" }}
        {...props}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
