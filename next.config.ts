import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: {
    "/api/home-visual": ["./private-assets/home/**/*"],
    "/api/schedule-asset/[...path]": ["./private-assets/schedule/**/*"],
  },
};

export default nextConfig;
