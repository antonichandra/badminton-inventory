import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

const DISMISS_THRESHOLD_PX = 80;
const VELOCITY_THRESHOLD = 0.5;
const DISMISS_ANIMATION_MS = 280;
const SNAP_BACK_MS = 200;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

interface UseSheetDragToCloseOptions {
  enabled: boolean;
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
}

export function useSheetDragToClose({
  enabled,
  open,
  onClose,
  panelRef,
}: UseSheetDragToCloseOptions) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const dragEnabled = enabled && !prefersReducedMotion;

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const animationTimerRef = useRef<number | null>(null);

  const clearAnimationTimer = useCallback(() => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setDragOffset(0);
      setIsDragging(false);
      setIsAnimating(false);
      clearAnimationTimer();
    }
  }, [open, clearAnimationTimer]);

  useEffect(() => clearAnimationTimer, [clearAnimationTimer]);

  const getDismissThreshold = useCallback(() => {
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    return Math.max(DISMISS_THRESHOLD_PX, panelHeight * 0.25);
  }, [panelRef]);

  const getPanelHeight = useCallback(() => {
    return panelRef.current?.offsetHeight ?? 400;
  }, [panelRef]);

  const animateToOffset = useCallback(
    (targetOffset: number, durationMs: number, onComplete?: () => void) => {
      setIsDragging(false);
      setIsAnimating(true);
      setDragOffset(targetOffset);
      clearAnimationTimer();
      animationTimerRef.current = window.setTimeout(() => {
        animationTimerRef.current = null;
        setIsAnimating(false);
        onComplete?.();
      }, durationMs);
    },
    [clearAnimationTimer],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragEnabled || isAnimating) {
        return;
      }

      if ((event.target as Element).closest("[data-sheet-close]")) {
        return;
      }

      clearAnimationTimer();
      setIsAnimating(false);
      startYRef.current = event.clientY;
      lastYRef.current = event.clientY;
      lastTimeRef.current = event.timeStamp;
      velocityRef.current = 0;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clearAnimationTimer, dragEnabled, isAnimating],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) {
        return;
      }

      const deltaY = event.clientY - startYRef.current;
      const offset = Math.max(0, deltaY);
      const timeDelta = event.timeStamp - lastTimeRef.current;

      if (timeDelta > 0) {
        velocityRef.current = (event.clientY - lastYRef.current) / timeDelta;
      }

      lastYRef.current = event.clientY;
      lastTimeRef.current = event.timeStamp;
      setDragOffset(offset);
    },
    [isDragging],
  );

  const finishDrag = useCallback(() => {
    if (!isDragging) {
      return;
    }

    const shouldDismiss =
      dragOffset > getDismissThreshold() ||
      velocityRef.current > VELOCITY_THRESHOLD;

    if (shouldDismiss) {
      animateToOffset(getPanelHeight(), DISMISS_ANIMATION_MS, onClose);
      return;
    }

    animateToOffset(0, SNAP_BACK_MS);
  }, [
    animateToOffset,
    dragOffset,
    getDismissThreshold,
    getPanelHeight,
    isDragging,
    onClose,
  ]);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      finishDrag();
    },
    [finishDrag, isDragging],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      animateToOffset(0, SNAP_BACK_MS);
    },
    [animateToOffset, isDragging],
  );

  const backdropOpacity =
    dragOffset > 0
      ? Math.max(0, 1 - dragOffset / getPanelHeight())
      : undefined;

  const panelStyle =
    dragOffset > 0 || isAnimating
      ? { transform: `translateY(${dragOffset}px)` }
      : undefined;

  return {
    dragEnabled,
    dragOffset,
    isDragging,
    isAnimating,
    backdropOpacity,
    panelStyle,
    dragZoneProps: dragEnabled
      ? {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerCancel,
        }
      : {},
  };
}
