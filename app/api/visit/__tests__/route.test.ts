import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/visit/route";
import { VISITOR_COOKIE, isVisitorId, visitorIdFrom } from "@/lib/visitor";

describe("Try the demo", () => {
  it("gives a new Visitor an ID in an http-only cookie and opens the Test Call screen", async () => {
    const response = await POST(new Request("http://localhost/api/visit", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/demo");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${VISITOR_COOKIE}=`));
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(isVisitorId(visitorIdFrom(cookie.split(";")[0]))).toBe(true);
  });

  it("keeps a returning Visitor's ID", async () => {
    const id = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
    const response = await POST(
      new Request("http://localhost/api/visit", { method: "POST", headers: { cookie: `${VISITOR_COOKIE}=${id}` } }),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("reading the Visitor cookie", () => {
  it("ignores a missing or made-up value", () => {
    expect(visitorIdFrom(null)).toBeNull();
    expect(visitorIdFrom(`${VISITOR_COOKIE}=not-an-id`)).toBeNull();
    expect(visitorIdFrom("other=1")).toBeNull();
  });
});
