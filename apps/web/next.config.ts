import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" }
  },
  allowedDevOrigins: ["192.168.1.168", "localhost"]
};

export default nextConfig;
