import { describe, expect, it, vi } from "vitest";
import ActorCallPage from "@/app/dev/actor-call/page";
import { POST } from "@/app/dev/actor-call/start/route";

vi.mock("server-only", () => ({}));

// Vitest runs with NODE_ENV=test: not the laptop's dev server.
describe("the AI actor's bridge, off the laptop's dev server", () => {
  it("has no page", () => {
    expect(() => ActorCallPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("starts no actor call", async () => {
    const response = await POST(new Request("http://localhost/dev/actor-call/start", { method: "POST" }));
    expect(response.status).toBe(404);
  });
});
