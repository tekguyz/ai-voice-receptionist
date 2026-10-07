// Vapi's messages are read, never trusted: these turn "anything" into a
// record or a trimmed string, so a missing or odd field never throws.

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
