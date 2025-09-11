import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure proper client/server component boundaries
  serverExternalPackages: ['dexie'],
  experimental: {
    // Help with client reference manifest generation
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
