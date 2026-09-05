import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import { AuthStatus } from "../components/AuthStatus";

export const metadata: Metadata = {
  title: "KonkurCom 360",
  description: "سایت مادر پلتفرم KonkurCom 360",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "Tahoma, Vazirmatn, sans-serif",
          background: "#F4F8FB",
          color: "#102A43",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "1rem 2rem",
            borderBottom: "1px solid #D7E2EA",
            background: "white",
          }}
        >
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link href="/">خانه</Link>
            <Link href="/courses">دوره‌ها</Link>
            <Link href="/questions">بانک سؤال</Link>
          </nav>
          <AuthStatus />
        </header>
        {children}
      </body>
    </html>
  );
}
