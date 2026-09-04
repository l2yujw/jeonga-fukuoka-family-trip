import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: {
    "/api/album-asset/[asset]": ["./private-assets/album/**/*"],
    "/api/cards-asset/[asset]": ["./private-assets/cards/**/*"],
    "/api/home-visual": ["./private-assets/home/**/*"],
    "/api/schedule-asset/[...path]": ["./private-assets/schedule/**/*"],
  },
};

export default nextConfig;
