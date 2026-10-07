import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/site";

afterEach(() => vi.unstubAllEnvs());

describe("the site address", () => {
  it("is the production address on Vercel, so preview images are absolute", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(siteUrl().href).toBe("https://ai-voice-receptionist-tekguyz.vercel.app/");
  });

  it("is localhost off Vercel", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });
});

describe("search engines", () => {
  it("list only the landing page in the sitemap", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(sitemap().map((entry) => entry.url)).toEqual(["https://ai-voice-receptionist-tekguyz.vercel.app/"]);
  });

  it("may crawl every page, so they can read each demo page's noindex", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://ai-voice-receptionist-tekguyz.vercel.app/sitemap.xml",
    });
  });
});
