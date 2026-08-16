import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next writes editor-tooling instruction files into the project root on
  // `next dev`. They are local editor configuration rather than part of the
  // application, so generation is turned off.
  agentRules: false,
};

export default nextConfig;
