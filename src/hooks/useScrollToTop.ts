import { useEffect, useRef } from "react";

export function useScrollToTop(dependencies: any[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = 0;
    }
  }, dependencies);
  return ref;
}
