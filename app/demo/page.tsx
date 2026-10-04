import type { Metadata } from "next";
import { SampleCallScreen } from "./sample-call-screen";

export const metadata: Metadata = {
  title: "Sample Call · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <SampleCallScreen />;
}
