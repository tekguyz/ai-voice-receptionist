import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Kalam } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

// The Service Ticket faces (DESIGN.md): condensed caps for the printed form,
// a plain sans for reading, a ballpoint hand for what the Receptionist captures.
const form = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow-condensed" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const hand = Kalam({ subsets: ["latin"], weight: "400", variable: "--font-kalam" });

export const viewport: Viewport = { themeColor: "#faf08a" };

export const metadata: Metadata = {
  // Link previews and the sitemap need absolute URLs on the live address.
  metadataBase: siteUrl(),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  // Out of search by default, so no page leaks in by mistake. The landing
  // page (app/page.tsx) is the only page that says index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${form.variable} ${body.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
