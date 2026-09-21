import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import { AdminShell } from "./AdminShell";

export const metadata = PRIVATE_PAGE_METADATA;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
