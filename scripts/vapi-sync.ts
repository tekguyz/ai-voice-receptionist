// Sends Luna (vapi/luna.ts) to Vapi: creates her the first time, updates her
// after, then reads back what Vapi saved and checks it.
//
//   npm run vapi:sync -- --dry-run   prints what would be sent; sends nothing
//   npm run vapi:sync                creates or updates Luna
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it.

import { LUNA_NAME, checkLuna, lunaAssistant } from "../vapi/luna.ts";

const API = "https://api.vapi.ai";
const body = lunaAssistant();

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(body, null, 2));
  console.log(`\nDry run: nothing sent. Checks: ${checkLuna(body).join(" ") || "all good."}`);
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

const named = ((await vapi("/assistant?limit=100")) as { id: string; name?: string }[]).filter((a) => a.name === LUNA_NAME);
if (named.length > 1) {
  console.error(`${named.length} assistants are named "${LUNA_NAME}". Delete the extras in the Vapi dashboard, then run again.`);
  process.exit(1);
}

const saved = named[0]
  ? await vapi(`/assistant/${named[0].id}`, { method: "PATCH", body })
  : await vapi("/assistant", { method: "POST", body });

const problems = checkLuna(saved);
if (problems.length > 0) {
  console.error(`Vapi saved Luna, but she fails these checks:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`${named[0] ? "Updated" : "Created"} "${LUNA_NAME}". All checks pass.`);
console.log(`VAPI_ASSISTANT_ID=${saved.id}`);
