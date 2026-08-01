import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The dev indicator badge sits bottom-left, the same corner as the
  // sidebar's account menu button, and intercepts clicks there.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
