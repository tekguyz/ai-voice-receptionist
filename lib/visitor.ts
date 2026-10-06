// A Visitor is known only by a random ID in an http-only cookie. No sign-in
// (ADR 0002). The ID files the Visitor's Test Calls and counts their limit.

export const VISITOR_COOKIE = "avr_visitor";
export const VISITOR_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function isVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The Visitor ID in a Cookie header, or null when there is none or it is not ours. */
export function visitorIdFrom(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) {
      const value = rest.join("=");
      return isVisitorId(value) ? value : null;
    }
  }
  return null;
}
