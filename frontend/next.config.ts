import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is what the Docker Compose frontend image runs (Dockerfile
  // copies .next/standalone instead of shipping full node_modules).
  output: "standalone",
};

export default nextConfig;
