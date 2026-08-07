import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" }
  },
  allowedDevOrigins: ["credit.innotel.us", "192.168.1.168", "localhost"]
};

export default nextConfig;
