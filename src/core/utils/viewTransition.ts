import type { NavigateOptions } from "react-router-dom";

type NavigateFn = (
  to: string,
  options?: NavigateOptions,
) => void | Promise<void>;

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

export function withViewTransition(callback: () => void | Promise<void>): void {
  if (supportsViewTransitions()) {
    (
      document as Document & {
        startViewTransition: (cb: () => void | Promise<void>) => void;
      }
    ).startViewTransition(callback);
  } else {
    void callback();
  }
}

export function navigateWithTransition(
  navigate: NavigateFn,
  path: string,
  options?: NavigateOptions,
): void | Promise<void> {
  return navigate(path, {
    ...options,
    viewTransition: supportsViewTransitions(),
  });
}
