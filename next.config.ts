import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/ec2-pricing-calculator",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
