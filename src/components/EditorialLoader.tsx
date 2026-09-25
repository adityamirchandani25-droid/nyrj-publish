import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const INITIAL_REVEAL_MS = 1050;
const EXIT_MS = 420;

export function EditorialLoader() {
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [initialLoad, setInitialLoad] = useState(true);
  const [mounted, setMounted] = useState(true);
  const shouldShow = initialLoad || navigating;

  useEffect(() => {
    const timer = window.setTimeout(() => setInitialLoad(false), INITIAL_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      return;
    }

    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <div
      className={`editorial-loader ${shouldShow ? "is-visible" : "is-leaving"}`}
      role="status"
      aria-live="polite"
      aria-label="Preparing the next page"
    >
      <div className="editorial-loader__scene" aria-hidden="true">
        <div className="editorial-loader__shadow" />
        <div className="editorial-loader__paper">
          <span className="editorial-loader__monogram">NYRJ</span>
          <span className="editorial-loader__rule editorial-loader__rule--one" />
          <span className="editorial-loader__rule editorial-loader__rule--two" />
          <span className="editorial-loader__rule editorial-loader__rule--three" />
          <span className="editorial-loader__rule editorial-loader__rule--four" />
          <span className="editorial-loader__signature">Research in motion</span>
        </div>
        <div className="editorial-loader__pencil">
          <span className="editorial-loader__eraser" />
          <span className="editorial-loader__wood" />
        </div>
      </div>
      <p className="editorial-loader__label">Preparing the next page</p>
      <span className="editorial-loader__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
