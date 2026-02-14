import type { ReactNode } from "react";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  padded?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function SurfaceCard({
  children,
  className,
  padded = "md",
}: SurfaceCardProps) {
  return (
    <section
      className={[
        "rounded-3xl border border-slate-200/80 bg-white shadow-[0_22px_54px_-44px_rgba(15,23,42,0.35)]",
        paddingClasses[padded],
        className ?? "",
      ].join(" ")}
    >
      {children}
    </section>
  );
}
