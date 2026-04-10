import { DependencyList, useEffect } from "react";

export function useDebouncedEffect(
  effect: () => void,
  delayMs: number,
  dependencies: DependencyList,
): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      effect();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, dependencies);
}
