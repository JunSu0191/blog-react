import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: React.ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyle =
    "font-medium transition-all duration-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-blue-600 text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,0.8)] hover:bg-blue-700 focus-visible:ring-blue-500",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400",
    ghost:
      "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",
    outline:
      "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${
        className ?? ""
      }`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "로딩 중..." : children}
    </button>
  );
}
