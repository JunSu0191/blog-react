import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";

type UserAvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
};

function resolveInitial(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return "U";
  return normalized.slice(0, 1).toUpperCase();
}

export default function UserAvatar({
  name,
  imageUrl,
  alt,
  className,
  fallbackClassName,
  imageClassName,
}: UserAvatarProps) {
  const normalizedUrl = imageUrl?.trim() || undefined;
  const initial = resolveInitial(name);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [normalizedUrl]);

  const shouldShowImage = Boolean(normalizedUrl) && !hasImageError;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
        className,
      )}
    >
      {shouldShowImage ? (
        <img
          src={normalizedUrl}
          alt={alt || `${name || "사용자"} 아바타`}
          className={cn("absolute inset-0 h-full w-full object-cover", imageClassName)}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center bg-blue-100 font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
            fallbackClassName,
          )}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
