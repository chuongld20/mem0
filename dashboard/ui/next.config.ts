import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL || "http://dashboard-api:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${apiUrl}/mcp/:path*`,
      },
    ];
  },
};

export default nextConfig;
