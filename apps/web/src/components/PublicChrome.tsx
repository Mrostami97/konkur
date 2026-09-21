"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the marketing header, footer and mobile tab bar on /admin. The admin
 * panel has its own shell and chrome; showing the public nav above it gives
 * an operator two competing navigations and a "back to site" link they did
 * not ask for on every screen.
 */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
