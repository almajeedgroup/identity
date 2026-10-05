'use client';

import { useEffect } from 'react';

/** Marks the page as interactive (used by acceptance tests to avoid acting before hydration). */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
