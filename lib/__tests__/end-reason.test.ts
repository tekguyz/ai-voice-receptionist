import { describe, expect, it } from "vitest";
import { endReasonFrom } from "@/lib/end-reason";

describe("Vapi's end reasons", () => {
  it("maps the time limit", () => {
    expect(endReasonFrom("exceeded-max-duration")).toBe("time-limit");
  });

  it("counts a caller who left or stayed silent as a caller who hung up", () => {
    expect(endReasonFrom("customer-ended-call")).toBe("caller-hung-up");
    expect(endReasonFrom("silence-timed-out")).toBe("caller-hung-up");
  });

  it("maps Luna hanging up", () => {
    expect(endReasonFrom("assistant-ended-call")).toBe("receptionist-finished");
  });

  it("maps any other reason to an error", () => {
    expect(endReasonFrom("pipeline-error-openai-llm-failed")).toBe("error");
  });

  it("has no reason: finished, unless the browser saw a fatal error", () => {
    expect(endReasonFrom(undefined)).toBe("receptionist-finished");
    expect(endReasonFrom(undefined, true)).toBe("error");
  });
});
