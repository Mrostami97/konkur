import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import { InstructorShell } from "./InstructorShell";

export const metadata = PRIVATE_PAGE_METADATA;

export default function InstructorLayout({ children }: { children: ReactNode }) {
  return <InstructorShell>{children}</InstructorShell>;
}
