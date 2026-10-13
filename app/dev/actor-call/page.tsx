// Dev only: the AI actor calls Luna in this tab (spec 2026-10-13). 404 on
// every deploy and in production.
import { notFound } from "next/navigation";
import { isLaptopDev } from "@/lib/laptop-dev";
import { ActorBridge } from "./bridge";

export const dynamic = "force-dynamic";

export default function ActorCallPage() {
  if (!isLaptopDev(process.env)) notFound();
  return <ActorBridge />;
}
