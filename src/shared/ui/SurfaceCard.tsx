import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/shared/lib/cn";

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
    <Card
      className={cn(
        "rounded-3xl border-slate-200/80 bg-white/95 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-[0_24px_70px_-46px_rgba(2,6,23,0.7)]",
        paddingClasses[padded],
        className,
      )}
    >
      {children}
    </Card>
  );
}
