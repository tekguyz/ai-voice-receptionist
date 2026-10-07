import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CallNotesSheet } from "@/app/_ui/call-notes";
import { DemoBanner, FormLink } from "@/app/_ui/ticket";
import { callTimeLabel, findDashboardCall } from "@/lib/dashboard";
import { serverNotesStore } from "@/lib/server-notes-store";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";

export const metadata: Metadata = {
  title: "Call Notes · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

export default async function DashboardCallPage({ params }: { params: Promise<{ callId: string }> }) {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");

  const { callId } = await params;
  const now = new Date();
  // Only a sample call or one of this Visitor's own: anything else is "not found".
  const call = await findDashboardCall({ callId, visitorId, now, store: serverNotesStore() });
  if (!call) notFound();

  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-10 md:pt-12">
        <CallNotesSheet
          notes={call.notes}
          state={call.whose === "yours" ? "saved" : "sample"}
          number={call.number}
          spam={call.spam}
          when={callTimeLabel(call.at, now)}
          actions={
            <>
              <FormLink href="/demo/dashboard">Back to the Dashboard</FormLink>
              <FormLink href="/demo">Make a Test Call</FormLink>
            </>
          }
        />
      </main>
    </>
  );
}
