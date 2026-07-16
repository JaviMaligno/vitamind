"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Bottom-tab order — swiping left goes to the next, right to the previous. */
const TABS = ["/dashboard", "/explore", "/profile"];

/**
 * Enables swiping left/right between the three main tab screens on touch
 * devices (in addition to tapping the bottom bar). Only fires on the tab routes,
 * only for a clearly HORIZONTAL gesture, and never when the swipe starts inside a
 * horizontally-scrollable element (the forecast row, region chips, the viz map),
 * so those keep scrolling instead of flipping the page.
 */
export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  const idx = TABS.indexOf(pathname);

  // Direction of the last tab change, so the incoming screen slides in from the
  // side you swiped toward (forward = from the right, back = from the left) —
  // a natural, Android-like transition instead of an instant jump.
  const prevIdxRef = useRef(idx);
  const dirRef = useRef(0);
  if (idx !== -1 && prevIdxRef.current !== -1 && idx !== prevIdxRef.current) {
    dirRef.current = idx > prevIdxRef.current ? 1 : -1;
  }
  if (idx !== -1) prevIdxRef.current = idx;
  const anim = idx === -1 ? "" : dirRef.current < 0 ? "animate-tab-in-left" : "animate-tab-in-right";

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Bail if the gesture begins inside a horizontal scroller — let it scroll.
    let el = e.target as HTMLElement | null;
    const root = e.currentTarget as HTMLElement;
    while (el && el !== root) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4) {
        start.current = null;
        return;
      }
      el = el.parentElement;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || idx === -1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Significant + predominantly horizontal (avoids vertical-scroll false hits).
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && idx < TABS.length - 1) router.push(TABS[idx + 1]);
    else if (dx > 0 && idx > 0) router.push(TABS[idx - 1]);
  }, [idx, router]);

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div key={pathname} className={anim}>
        {children}
      </div>
    </div>
  );
}
