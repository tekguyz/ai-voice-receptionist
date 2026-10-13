// Scores one Vapi call against Luna's pass bar (spec 2026-10-13).
//
//   npm run luna:report -- <callId>
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it. Exit code 1 when
// the call misses the bar.

import { formatLunaReport, lunaFailures, lunaReport } from "./luna-check.ts";

const key = process.env.VAPI_PRIVATE_KEY;
const callId = process.argv[2];

// No process.exit() after a fetch: on Windows it can crash Node while the connection closes.
process.exitCode = await main();

async function main(): Promise<number> {
  if (!key) {
    console.error("VAPI_PRIVATE_KEY is missing. Add it to .env.local.");
    return 1;
  }
  if (!callId) {
    console.error("Usage: npm run luna:report -- <callId>");
    return 1;
  }
  const response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) {
    console.error(`Vapi answered ${response.status}: ${await response.text()}`);
    return 1;
  }
  const report = lunaReport(await response.json());
  console.log(formatLunaReport(report));
  return lunaFailures(report).length ? 1 : 0;
}
