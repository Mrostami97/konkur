import type { ReactNode } from "react";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";

export const metadata = { ...PRIVATE_PAGE_METADATA, title: "بانک سؤال" };
export default function QuestionsLayout({ children }: { children: ReactNode }) { return children; }
