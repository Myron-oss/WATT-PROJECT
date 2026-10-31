import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the dev-only "N" indicator in the corner
  devIndicators: false,
  // lets a production build run next to `next dev` (NEXT_DIST_DIR=.next-build npm run build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
