import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the demo reproducible: no telemetry, no remote image hosts.
  reactStrictMode: true,
};

export default nextConfig;
