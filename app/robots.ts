import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Crawlers may fetch every page. Demo screens stay out of search by their own
// `noindex` tag, not here: a crawler blocked by robots.txt never sees the tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
