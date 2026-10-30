import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { demoModeEnabled } from "@/lib/services/actor";

export const metadata: Metadata = {
  title: { default: "Lecta — the things we keep", template: "%s · Lecta" },
  description: "Lecta is a living exhibition of the things you love, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Open-licensed (OFL) fonts. If they fail to load, Georgia / system sans take over without layout breakage. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Noto+Sans+KR:wght@400;500&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
        <Header demo={demoModeEnabled()} />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
