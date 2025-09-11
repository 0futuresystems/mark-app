import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure proper client/server component boundaries
  serverExternalPackages: ['dexie'],
};

export default nextConfig;
