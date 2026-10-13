// Sends Luna (vapi/luna.ts) and the Caller actor (vapi/actor.ts) to Vapi:
// creates each the first time, updates it after, then reads back what Vapi
// saved and checks it.
//
//   npm run vapi:sync -- --dry-run   prints what would be sent; sends nothing
//   npm run vapi:sync                creates or updates both
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it.

import { ACTOR_NAME, actorAssistant, checkActor } from "../vapi/actor.ts";
import { LUNA_NAME, checkLuna, lunaAssistant } from "../vapi/luna.ts";

const API = "https://api.vapi.ai";
const ASSISTANTS = [
  { name: LUNA_NAME, body: lunaAssistant(), check: checkLuna, idVar: "VAPI_ASSISTANT_ID" },
  { name: ACTOR_NAME, body: actorAssistant(), check: checkActor, idVar: "VAPI_ACTOR_ID" },
];

if (process.argv.includes("--dry-run")) {
  for (const { name, body, check } of ASSISTANTS) {
    console.log(JSON.stringify(body, null, 2));
    console.log(`\n${name}: dry run, nothing sent. Checks: ${check(body).join(" ") || "all good."}\n`);
  }
  process.exit(0);
}

const key = process.env.VAPI_PRIVATE_KEY;
if (!key) {
  console.error("VAPI_PRIVATE_KEY is missing. Add it to .env.local.");
  process.exit(1);
}

async function vapi(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Vapi ${init.method ?? "GET"} ${path} answered ${response.status}: ${text}`);
  return JSON.parse(text);
}

const all = (await vapi("/assistant?limit=100")) as { id: string; name?: string }[];
for (const { name, body, check, idVar } of ASSISTANTS) {
  const named = all.filter((a) => a.name === name);
  if (named.length > 1) {
    console.error(`${named.length} assistants are named "${name}". Delete the extras in the Vapi dashboard, then run again.`);
    process.exit(1);
  }
  const saved = named[0] ? await vapi(`/assistant/${named[0].id}`, { method: "PATCH", body }) : await vapi("/assistant", { method: "POST", body });
  const problems = check(saved);
  if (problems.length > 0) {
    console.error(`Vapi saved "${name}", but it fails these checks:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${named[0] ? "Updated" : "Created"} "${name}". All checks pass.`);
  console.log(`${idVar}=${saved.id}`);
}
