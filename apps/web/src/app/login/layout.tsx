import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";

export const metadata = PRIVATE_PAGE_METADATA;
export default function LoginLayout({ children }: { children: ReactNode }) { return children; }
