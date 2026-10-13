import { describe, expect, it } from "vitest";
import { onceLoader } from "@/lib/vapi-browser";

describe("loading the Vapi SDK", () => {
  it("loads once, however often it is asked", async () => {
    let loads = 0;
    const load = onceLoader(async () => ++loads);
    expect(await Promise.all([load(), load(), load()])).toEqual([1, 1, 1]);
    expect(loads).toBe(1);
  });

  it("tries again after a failed load, so one bad preload does not block every call", async () => {
    let loads = 0;
    const load = onceLoader(async () => {
      loads++;
      if (loads === 1) throw new Error("offline");
      return "sdk";
    });
    await expect(load()).rejects.toThrow("offline");
    expect(await load()).toBe("sdk");
  });
});
