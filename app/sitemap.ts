import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only the landing page. Demo screens never go in the sitemap (spec #1, story 5).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl().href, changeFrequency: "monthly", priority: 1 }];
}
