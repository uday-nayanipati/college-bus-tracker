import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: almost every page here is per-user and live
  // (auth cookies, Realtime), so standard dynamic rendering is simpler.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
