import { useEffect, useRef } from "react";
import { useNavigationType } from "react-router-dom";

/**
 * Sets `data-vt-direction` on <html> so CSS can reverse slide on browser back.
 */
export function ViewTransitionHandler() {
  const navigationType = useNavigationType();
  const isInitialNavigation = useRef(true);

  useEffect(() => {
    const root = document.documentElement;

    if (isInitialNavigation.current) {
      isInitialNavigation.current = false;
      root.dataset.vtDirection = "forward";
      return;
    }

    root.dataset.vtDirection =
      navigationType === "POP" ? "back" : "forward";
  }, [navigationType]);

  return null;
}
