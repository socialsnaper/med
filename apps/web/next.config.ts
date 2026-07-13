import type { NextConfig } from "next";
import path from "path";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  turbopack: {
    // npm workspaces hoists node_modules to the monorepo root, so Turbopack
    // must resolve from there to find next/package.json and other hoisted packages.
    root: path.resolve(__dirname, "../.."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
