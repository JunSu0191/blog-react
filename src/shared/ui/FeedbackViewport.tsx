import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  CircleAlert,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import Button from "./Button";
import {
  dismissFeedback,
  getDefaultFeedbackDuration,
  getDefaultFeedbackPresentation,
  subscribeToFeedback,
  type FeedbackLevel,
  type FeedbackPayload,
  type FeedbackPresentation,
} from "./feedbackBus";

type RenderFeedback = FeedbackPayload & {
  presentation: FeedbackPresentation;
  durationMs: number;
  signature: string;
};

function getFeedbackSignature(item: Pick<RenderFeedback, "message" | "level" | "presentation" | "dedupeKey">) {
  return (
    item.dedupeKey ??
    `${item.presentation}:${item.level}:${item.message.trim().toLowerCase()}`
  );
}

function useCompactFeedbackLayout() {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isCompact;
}

function feedbackAppearance(level: FeedbackLevel, presentation: FeedbackPresentation) {
  if (presentation === "banner") {
    if (level === "warning") {
      return {
        icon: TriangleAlert,
        shell:
          "border-amber-200/90 bg-amber-50/95 text-amber-950 shadow-[0_18px_50px_-36px_rgba(180,83,9,0.55)] dark:border-amber-900/70 dark:bg-amber-950/75 dark:text-amber-50",
        accent: "text-amber-600 dark:text-amber-300",
        action: "text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/60",
      };
    }
    if (level === "error") {
      return {
        icon: CircleAlert,
        shell:
          "border-rose-200/90 bg-rose-50/95 text-rose-950 shadow-[0_18px_50px_-36px_rgba(225,29,72,0.55)] dark:border-rose-900/70 dark:bg-rose-950/75 dark:text-rose-50",
        accent: "text-rose-600 dark:text-rose-300",
        action: "text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/60",
      };
    }
    if (level === "success") {
      return {
        icon: CheckCircle2,
        shell:
          "border-emerald-200/90 bg-emerald-50/95 text-emerald-950 shadow-[0_18px_50px_-36px_rgba(5,150,105,0.55)] dark:border-emerald-900/70 dark:bg-emerald-950/75 dark:text-emerald-50",
        accent: "text-emerald-600 dark:text-emerald-300",
        action: "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
      };
    }
    return {
      icon: Info,
      shell:
        "border-blue-200/90 bg-white/96 text-slate-900 shadow-[0_20px_56px_-36px_rgba(37,99,235,0.5)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50",
      accent: "text-blue-600 dark:text-blue-200",
      action:
        "text-slate-600 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
    };
  }

  if (level === "warning") {
    return {
      icon: TriangleAlert,
      shell:
        "border-amber-200/90 bg-amber-50/95 text-amber-950 shadow-[0_20px_56px_-36px_rgba(180,83,9,0.62)] dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
      accent: "text-amber-600 dark:text-amber-200",
      action:
        "text-amber-700 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/60",
    };
  }
  if (level === "error") {
    return {
      icon: CircleAlert,
      shell:
        "border-rose-200/90 bg-rose-50/95 text-rose-950 shadow-[0_22px_60px_-38px_rgba(225,29,72,0.65)] dark:border-rose-800 dark:bg-rose-950 dark:text-rose-50",
      accent: "text-rose-600 dark:text-rose-200",
      action:
        "text-rose-700 hover:bg-rose-100 dark:text-rose-100 dark:hover:bg-rose-900/60",
    };
  }
  if (level === "success") {
    return {
      icon: CheckCircle2,
      shell:
        "border-emerald-200/90 bg-emerald-50/95 text-emerald-950 shadow-[0_22px_60px_-38px_rgba(5,150,105,0.62)] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50",
      accent: "text-emerald-600 dark:text-emerald-200",
      action:
        "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-900/60",
    };
  }
  if (level === "info") {
    return {
      icon: Info,
      shell:
        "border-blue-200/90 bg-white/96 text-slate-900 shadow-[0_22px_60px_-38px_rgba(37,99,235,0.58)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50",
      accent: "text-blue-600 dark:text-blue-200",
      action:
        "text-slate-600 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
    };
  }
  return {
    icon: Info,
    shell:
      "border-slate-200/90 bg-white/96 text-slate-900 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.42)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50",
    accent: "text-slate-500 dark:text-slate-200",
    action:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
  };
}

function FeedbackCard({
  item,
  compact,
}: {
  item: RenderFeedback;
  compact: boolean;
}) {
  const appearance = feedbackAppearance(item.level, item.presentation);
  const Icon = appearance.icon;

  return (
    <div
      className={cn(
        "feedback-enter pointer-events-auto flex w-full items-start gap-3 rounded-[1.35rem] border px-3.5 py-3 backdrop-blur-xl",
        compact ? "max-w-full" : "max-w-[380px]",
        item.presentation === "banner" ? "sm:max-w-[560px]" : "",
        appearance.shell,
      )}
    >
      <div
        className={cn(
          "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 dark:bg-slate-950/40",
          appearance.accent,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-6">{item.message}</p>
        {item.actionLabel && item.onAction ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                item.onAction?.();
                dismissFeedback(item.id);
              }}
              className={cn("h-8 rounded-xl px-2.5 text-xs font-semibold", appearance.action)}
            >
              {item.actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismissFeedback(item.id)}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition",
          appearance.action,
        )}
        aria-label="알림 닫기"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function useFeedbackQueue() {
  const [items, setItems] = useState<RenderFeedback[]>([]);
  const timeoutIdsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const unsubscribe = subscribeToFeedback((event) => {
      if (event.type === "dismiss") {
        setItems((prev) =>
          typeof event.id === "string"
            ? prev.filter((item) => item.id !== event.id)
            : [],
        );
        if (typeof event.id === "string") {
          const timeoutId = timeoutIdsRef.current.get(event.id);
          if (typeof timeoutId === "number") {
            window.clearTimeout(timeoutId);
            timeoutIdsRef.current.delete(event.id);
          }
        } else {
          timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
          timeoutIdsRef.current.clear();
        }
        return;
      }

      setItems((prev) => {
        const nextPresentation =
          event.payload.presentation ??
          getDefaultFeedbackPresentation(event.payload.level);
        const nextDuration =
          event.payload.durationMs ??
          getDefaultFeedbackDuration(event.payload.level, nextPresentation);
        const nextItem: RenderFeedback = {
          ...event.payload,
          presentation: nextPresentation,
          durationMs: nextDuration,
          signature: getFeedbackSignature({
            ...event.payload,
            presentation: nextPresentation,
          }),
        };

        const existingIndex = prev.findIndex(
          (item) => item.signature === nextItem.signature,
        );

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          const timeoutId = timeoutIdsRef.current.get(existing.id);
          if (typeof timeoutId === "number") {
            window.clearTimeout(timeoutId);
            timeoutIdsRef.current.delete(existing.id);
          }
          return [
            {
              ...existing,
              ...nextItem,
              id: existing.id,
            },
            ...prev.filter((_, index) => index !== existingIndex),
          ].slice(0, 6);
        }

        return [nextItem, ...prev].slice(0, 6);
      });
    });

    return () => {
      unsubscribe();
      const timeoutIds = timeoutIdsRef.current;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.clear();
    };
  }, []);

  useEffect(() => {
    const nextIds = new Set(items.map((item) => item.id));

    timeoutIdsRef.current.forEach((timeoutId, id) => {
      if (!nextIds.has(id)) {
        window.clearTimeout(timeoutId);
        timeoutIdsRef.current.delete(id);
      }
    });

    items.forEach((item) => {
      if (timeoutIdsRef.current.has(item.id)) return;
      const timeoutId = window.setTimeout(() => {
        dismissFeedback(item.id);
      }, item.durationMs);
      timeoutIdsRef.current.set(item.id, timeoutId);
    });
  }, [items]);

  return { items };
}

export function FeedbackViewport() {
  const compact = useCompactFeedbackLayout();
  const { items } = useFeedbackQueue();

  const banners = useMemo(
    () =>
      items
        .filter((item) => item.presentation === "banner")
        .slice(0, compact ? 1 : 2),
    [compact, items],
  );
  const snackbars = useMemo(
    () =>
      items
        .filter((item) => item.presentation === "snackbar")
        .slice(0, compact ? 1 : 3),
    [compact, items],
  );

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[130] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        {banners.map((item) => (
          <FeedbackCard key={item.id} item={item} compact={compact} />
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[130] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] sm:left-auto sm:right-4 sm:w-[min(100%,380px)] sm:items-end sm:px-0">
        {snackbars.map((item) => (
          <FeedbackCard key={item.id} item={item} compact={compact} />
        ))}
      </div>
    </>
  );
}
