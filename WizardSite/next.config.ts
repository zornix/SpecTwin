import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The showcase is now the homepage; keep old links/demo URLs working.
      { source: "/showcase", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
