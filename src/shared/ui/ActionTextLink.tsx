import { ArrowRight } from "lucide-react";
import { Link, type LinkProps } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type ActionTextLinkProps = LinkProps & {
  children: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
};

export default function ActionTextLink({
  children,
  className,
  icon,
  iconClassName,
  ...props
}: ActionTextLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 transition-[background-color,color,transform,box-shadow] duration-200 ease-out hover:bg-blue-100/80 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-200",
        className,
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "transition-transform duration-200 ease-out group-hover:translate-x-0.5",
          iconClassName,
        )}
      >
        {icon ?? <ArrowRight className="h-4 w-4" />}
      </span>
    </Link>
  );
}
