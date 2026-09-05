import type { Metadata } from "next";
import type { ReactNode } from "react";

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
        {children}
      </body>
    </html>
  );
}
