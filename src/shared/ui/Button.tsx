import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  Button as ShadcnButton,
  buttonVariants as shadcnButtonVariants,
  type ButtonProps as ShadcnButtonProps,
} from "@/components/ui/button";
import { cn } from "@/shared/lib/cn";

type LegacyVariant = "primary" | "secondary" | "ghost" | "outline";
type LegacySize = "sm" | "md" | "lg" | "icon";

const variantMap: Record<LegacyVariant, NonNullable<ShadcnButtonProps["variant"]>> = {
  primary: "brand",
  secondary: "secondary",
  ghost: "ghost",
  outline: "outline",
};

const sizeMap: Record<LegacySize, NonNullable<ShadcnButtonProps["size"]>> = {
  sm: "sm",
  md: "default",
  lg: "lg",
  icon: "icon",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: LegacyVariant;
  size?: LegacySize;
  className?: string;
} = {}) {
  return cn(
    shadcnButtonVariants({
      variant: variantMap[variant],
      size: sizeMap[size],
    }),
    "rounded-xl font-semibold transition-all duration-200",
    className,
  );
}

type ButtonProps = Omit<ComponentProps<typeof ShadcnButton>, "variant" | "size"> & {
    variant?: LegacyVariant;
    size?: LegacySize;
    isLoading?: boolean;
    loadingText?: ReactNode;
    children: ReactNode;
  };

export default function Button({
  variant,
  size,
  isLoading = false,
  loadingText = "로딩 중...",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant || "primary"]}
      size={sizeMap[size || "md"]}
      className={cn(
        "rounded-xl font-semibold transition-all duration-200",
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  );
}
