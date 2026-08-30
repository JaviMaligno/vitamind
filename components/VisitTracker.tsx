"use client";

import { useEffect, useRef } from "react";
import { trackVisit } from "@/lib/analytics";

/**
 * Emits one `visit` event per page load, carrying whether this browser is new
 * or returning and how many distinct days it has opened the app.
 *
 * With no account there is no user id to retain against, so the return visit —
 * same browser, a later calendar day — is the retention signal. It is also the
 * only one that survives the product's own "no sign-up needed" promise.
 *
 * Renders nothing and holds no state, so it never triggers a re-render.
 */
export default function VisitTracker() {
  const fired = useRef(false);

  useEffect(() => {
    // React 18 StrictMode runs effects twice in development; the ref keeps the
    // day counter from advancing twice on a single load.
    if (fired.current) return;
    fired.current = true;
    trackVisit();
  }, []);

  return null;
}
