import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      // Legacy Portuguese page routes
      { source: "/novidades", destination: "/whats-new", permanent: true },
      { source: "/parada/setup", destination: "/chart/setup", permanent: true },
      { source: "/sobre", destination: "/about", permanent: true },
      { source: "/politica-de-privacidade", destination: "/privacy-policy", permanent: true },
      { source: "/termos-de-uso", destination: "/terms-of-use", permanent: true },
      { source: "/contato", destination: "/contact", permanent: true },
      // Legacy upload path (logos stored in DB with old URL)
      { source: "/api/uploads/parada-logos/:filename*", destination: "/api/uploads/chart-logos/:filename*", permanent: true },
    ];
  },
};

export default nextConfig;
