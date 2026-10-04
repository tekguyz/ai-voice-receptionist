import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: the browser pane previews on 127.0.0.1. Without this, dev
  // blocks its scripts there and no page hydrates.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
