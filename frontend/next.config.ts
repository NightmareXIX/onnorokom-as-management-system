import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is what the Docker Compose frontend image runs (Dockerfile
  // copies .next/standalone instead of shipping full node_modules). Vercel's own
  // build pipeline has its own serverless output format and breaks
  // (ENOENT on .next/next-server.js.nft.json) if standalone is forced, so skip it
  // there — Vercel sets the VERCEL env var automatically during its builds.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
