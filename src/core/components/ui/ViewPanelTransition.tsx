import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn";

const EXIT_MS = 280;

interface ViewPanelTransitionProps {
  panelKey: string;
  children: ReactNode;
}

export function ViewPanelTransition({
  panelKey,
  children,
}: ViewPanelTransitionProps) {
  const [displayKey, setDisplayKey] = useState(panelKey);
  const [content, setContent] = useState(children);
  const [phase, setPhase] = useState<"enter" | "exit" | "idle">("enter");
  const pendingChildrenRef = useRef(children);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    pendingChildrenRef.current = children;

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      setDisplayKey(panelKey);
      setContent(children);
      setPhase("enter");
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("idle"));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (panelKey === displayKey) {
      setContent(children);
      return;
    }

    setPhase("exit");
    const timer = window.setTimeout(() => {
      setDisplayKey(panelKey);
      setContent(pendingChildrenRef.current);
      setPhase("enter");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("idle"));
      });
    }, EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [panelKey, children, displayKey]);

  return (
    <div
      data-view-panel
      className={cn(
        phase === "enter" &&
          "animate-[feedback-enter_320ms_cubic-bezier(0.32,0.72,0,1)_forwards]",
        phase === "exit" &&
          "animate-[feedback-exit_280ms_cubic-bezier(0.32,0.72,0,1)_forwards]",
      )}
    >
      {content}
    </div>
  );
}
