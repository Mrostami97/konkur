import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import { StudentShell } from "./StudentShell";

export const metadata = PRIVATE_PAGE_METADATA;

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
