import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/ec2-pricing-calculator" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
