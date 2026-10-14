import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The Planner imports the public catalog packaged with the backend.
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
