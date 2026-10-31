import type { Metadata } from "next";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { demoModeEnabled } from "@/lib/services/actor";

export const metadata: Metadata = {
  title: { default: "Lecta — the things we keep", template: "%s / Lecta" },
  description: "Lecta is a living exhibition of the things you love, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      <html lang="ko">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          {/* All fonts are SIL Open Font License: Instrument Serif, Instrument Sans, Gowun Batang (Google Fonts), Pretendard (jsDelivr). */}
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&family=Gowun+Batang&display=swap" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        </head>
        <body>
          <a href="#main" className="sr-only">Skip to content</a>
          <Header demo={demoModeEnabled()} />
          <main id="main">{children}</main>
          <Footer />
        </body>
      </html>
    </ViewTransitions>
  );
}
