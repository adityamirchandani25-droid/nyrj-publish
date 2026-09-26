import { useEffect, useRef, type ReactNode } from "react";

const REVEAL_SELECTOR = [
  "section",
  "article",
  "form",
  "h1",
  "h2",
  "h3",
  "p",
  "ul",
  "ol",
  "blockquote",
  "figure",
  "table",
  "[data-scroll-reveal]",
].join(",");

const EXCLUDED_SELECTOR = [
  "[data-no-scroll-reveal]",
  "[role='dialog']",
  "[role='alertdialog']",
  "[data-radix-popper-content-wrapper]",
].join(",");

/** Adds one-time, progressively enhanced reveals to meaningful page content. */
export function ScrollRevealRegion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

    root.classList.add("scroll-reveal-enabled");
    const observed = new WeakSet<Element>();

    const reveal = (element: Element) => {
      element.setAttribute("data-scroll-reveal-state", "revealed");
      observer.unobserve(element);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        entering.forEach((entry, index) => {
          const element = entry.target as HTMLElement;
          element.style.setProperty("--scroll-reveal-delay", `${Math.min(index * 55, 165)}ms`);
          reveal(element);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );

    const register = (scope: ParentNode) => {
      const candidates = [
        ...(scope instanceof Element && scope.matches(REVEAL_SELECTOR) ? [scope] : []),
        ...scope.querySelectorAll(REVEAL_SELECTOR),
      ];

      for (const element of candidates) {
        if (observed.has(element) || element.closest(EXCLUDED_SELECTOR)) continue;
        observed.add(element);
        element.setAttribute("data-scroll-reveal-state", "pending");
        observer.observe(element);
      }
    };

    register(root);
    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) register(node);
        }
      }
    });
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
      root.classList.remove("scroll-reveal-enabled");
    };
  }, []);

  return (
    <main ref={rootRef} className="page-canvas flex-1">
      {children}
    </main>
  );
}
