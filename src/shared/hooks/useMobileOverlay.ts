import { useEffect, useRef, useState } from "react";

type UseMobileVisualViewportHeightOptions = {
  freezeWhileKeyboardOpen?: boolean;
  minHeight?: number;
};

type UseBodyScrollLockOptions = {
  lockScrollPosition?: boolean;
};

export function useMobileVisualViewportHeight(
  active: boolean,
  {
    freezeWhileKeyboardOpen = false,
    minHeight = 1,
  }: UseMobileVisualViewportHeightOptions = {},
) {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined"
      ? minHeight
      : Math.max(minHeight, Math.round(window.innerHeight)),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!active) return;

    const measure = () =>
      Math.max(
        minHeight,
        Math.round(window.visualViewport?.height ?? window.innerHeight),
      );
    let baseHeight = measure();
    const visualViewport = window.visualViewport;

    const updateViewport = () => {
      const measuredHeight = measure();
      const keyboardLikelyOpen = baseHeight - measuredHeight > 120;
      const nextHeight =
        freezeWhileKeyboardOpen && keyboardLikelyOpen
          ? baseHeight
          : measuredHeight;

      if (!freezeWhileKeyboardOpen || !keyboardLikelyOpen) {
        baseHeight = measuredHeight;
      }

      setViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const handleOrientationChange = () => {
      const measuredHeight = measure();
      baseHeight = measuredHeight;
      setViewportHeight((prev) =>
        prev === measuredHeight ? prev : measuredHeight,
      );
      window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    visualViewport?.addEventListener("resize", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [active, freezeWhileKeyboardOpen, minHeight]);

  return viewportHeight;
}

export function useBodyScrollLock(
  active: boolean,
  { lockScrollPosition = false }: UseBodyScrollLockOptions = {},
) {
  const lockedScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (typeof window === "undefined") return;
    if (!active) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    if (lockScrollPosition) {
      lockedScrollYRef.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollYRef.current}px`;
      document.body.style.width = "100%";
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;

      if (lockScrollPosition) {
        window.scrollTo({ top: lockedScrollYRef.current, behavior: "auto" });
      }
    };
  }, [active, lockScrollPosition]);
}
