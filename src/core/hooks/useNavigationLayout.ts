import { useEffect, useState } from "react";

export type NavigationLayout = "sidebar" | "bottom";

const BOTTOM_NAV_MAX_WIDTH_PX = 1024;

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function resolveNavigationLayout(): NavigationLayout {
  if (typeof window === "undefined") {
    return "sidebar";
  }

  if (isStandalonePwa() && window.innerWidth < BOTTOM_NAV_MAX_WIDTH_PX) {
    return "bottom";
  }

  return "sidebar";
}

export function useNavigationLayout(): NavigationLayout {
  const [layout, setLayout] = useState<NavigationLayout>(resolveNavigationLayout);

  useEffect(() => {
    const update = () => setLayout(resolveNavigationLayout());

    window.addEventListener("resize", update);

    const displayModes = [
      "(display-mode: standalone)",
      "(display-mode: fullscreen)",
    ];

    const mediaQueries = displayModes.map((query) => window.matchMedia(query));
    for (const mq of mediaQueries) {
      mq.addEventListener("change", update);
    }

    return () => {
      window.removeEventListener("resize", update);
      for (const mq of mediaQueries) {
        mq.removeEventListener("change", update);
      }
    };
  }, []);

  return layout;
}
