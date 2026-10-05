import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";
import { CallScreen } from "./call-screen";

export const metadata: Metadata = {
  title: "Test Call · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

export default async function DemoPage() {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");
  return <CallScreen />;
}
