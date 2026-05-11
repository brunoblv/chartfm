import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/uploads/**" },
    ],
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
