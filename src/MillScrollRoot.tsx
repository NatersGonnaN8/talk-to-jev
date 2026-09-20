import { useEffect, useRef } from "react";
import { startMillScrollbars } from "./scrollbars";

export function MillScrollRoot() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return startMillScrollbars(node);
  }, []);
  return (
    <div
      id="mill-scroll-root"
      className="mill-scroll-root"
      ref={ref}
      aria-hidden="true"
    />
  );
}
