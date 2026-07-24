import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev indicator badge sits bottom-left, the same corner as the
  // sidebar's account menu button, and intercepts clicks there.
  devIndicators: false,
};

export default nextConfig;
