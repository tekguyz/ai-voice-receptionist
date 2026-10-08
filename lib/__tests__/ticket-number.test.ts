import { describe, expect, it } from "vitest";
import { sampleCalls } from "@/lib/sample-calls";
import { TEST_CALL_TICKET } from "@/lib/sample-business";
import { ticketNumberFor } from "@/lib/ticket-number";

describe("a Test Call's ticket number", () => {
  it("is five digits, and the same every time for the same call", () => {
    const id = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
    expect(ticketNumberFor(id)).toMatch(/^\d{5}$/);
    expect(ticketNumberFor(id)).toBe(ticketNumberFor(id));
  });

  it("differs from call to call", () => {
    const numbers = new Set(Array.from({ length: 40 }, (_, i) => ticketNumberFor(`call-${i}`)));
    expect(numbers.size).toBeGreaterThan(30);
  });

  it("is never one a sample call prints, and always above them", () => {
    const sample = sampleCalls(new Date("2026-10-06T16:00:00Z")).map((call) => call.number);
    for (let i = 0; i < 500; i++) {
      const number = ticketNumberFor(`call-${i}`);
      expect(sample).not.toContain(number);
      expect(Number(number)).toBeGreaterThanOrEqual(Number(TEST_CALL_TICKET));
    }
  });
});
