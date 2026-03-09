"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function useAnimation(setDoy: (updater: (d: number) => number) => void) {
  const [animating, setAnimating] = useState(false);
  const animRef = useRef<number>(0);

  const toggleAnim = useCallback(() => {
    if (animating) {
      cancelAnimationFrame(animRef.current);
      setAnimating(false);
    } else {
      setAnimating(true);
      const s = () => {
        setDoy((d: number) => d >= 365 ? 1 : d + 1);
        animRef.current = requestAnimationFrame(s);
      };
      animRef.current = requestAnimationFrame(s);
    }
  }, [animating, setDoy]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return { animating, toggleAnim };
}
