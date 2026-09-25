"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Routes that render their own full-height panel shell. */
const PANEL_ROOTS = ["/admin", "/instructor", "/account"];

/**
 * Hides the marketing header, footer and mobile tab bar on the panels. A panel
 * has its own shell and chrome; showing the public nav above it gives the
 * person two competing navigations and a "back to site" link they did not ask
 * for on every screen.
 */
/** A running exam (not its report): nothing on screen but the paper and the clock. */
const EXAM_SITTING = /^\/attempts\/[^/]+\/?$/;

export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const inPanel = PANEL_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
  if (inPanel || EXAM_SITTING.test(pathname)) return null;
  return <>{children}</>;
}
