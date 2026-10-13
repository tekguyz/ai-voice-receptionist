// The laptop's dev server: `npm run dev`, never a Vercel deploy. Dev-only
// tools (the Sample Call recording switch, the AI actor's bridge page) work
// only here.

/** process.env, or a plain object in tests. */
type Env = Readonly<Record<string, string | undefined>>;

export function isLaptopDev(env: Env): boolean {
  return env.NODE_ENV === "development" && !env.VERCEL_ENV;
}

/**
 * Where a laptop call's tool calls and report go. Vapi cannot reach the
 * laptop, so they go to a deployed site (SAMPLE_CALL_WEBHOOK_ORIGIN), and
 * Luna's booking works. Null off the laptop, or with no https origin.
 */
export function devWebhookOrigin(env: Env): string | null {
  if (!isLaptopDev(env)) return null;
  const origin = env.SAMPLE_CALL_WEBHOOK_ORIGIN?.trim() ?? "";
  return origin.startsWith("https://") ? origin.replace(/\/+$/, "") : null;
}
