"use client";

import { useComingSoon } from "../lib/availability";

/**
 * A small "coming soon" tag beside a link whose destination has nothing
 * published yet. It renders nothing until the live flags arrive and nothing
 * once the feature has content, so a menu never needs editing either way.
 */
export function SoonMark({ href }: { href: string }) {
  const soon = useComingSoon();
  if (!soon.has(href)) return null;
  return <span className="soon-pill">به‌زودی</span>;
}
