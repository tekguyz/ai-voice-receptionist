import type { Metadata } from "next";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Voice Receptionist",
  description: `Watch an AI Receptionist answer a call for ${SAMPLE_BUSINESS.name}, a made-up ${SAMPLE_BUSINESS.trade} shop.`,
  // Out of search by default, so no page leaks in by mistake. The landing
  // page (a later step) is the only page that says index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
