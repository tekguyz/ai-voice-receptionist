import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Kalam } from "next/font/google";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";
import "./globals.css";

// The Service Ticket faces (DESIGN.md): condensed caps for the printed form,
// a plain sans for reading, a ballpoint hand for what the Receptionist captures.
const form = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow-condensed" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const hand = Kalam({ subsets: ["latin"], weight: "400", variable: "--font-kalam" });

export const viewport: Viewport = { themeColor: "#faf08a" };

export const metadata: Metadata = {
  title: "AI Voice Receptionist",
  description: `Watch an AI Receptionist answer a call for ${SAMPLE_BUSINESS.name}, a made-up ${SAMPLE_BUSINESS.trade} shop.`,
  // Out of search by default, so no page leaks in by mistake. The landing
  // page (a later step) is the only page that says index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${form.variable} ${body.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
