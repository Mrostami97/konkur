import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";

export const metadata = { ...PRIVATE_PAGE_METADATA, title: "برنامهٔ امروز" };
export default function TodayLayout({ children }: { children: ReactNode }) { return children; }
