import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The Planner imports the public catalog packaged with the backend.
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
