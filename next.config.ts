import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow the optimizer to fetch from any Supabase project's public
    // storage — scoped to the public-objects path so nothing else qualifies.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
