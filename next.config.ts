import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    qualities: [75, 90],
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/sign-up",
        permanent: false,
      },
    ];
  },
};

export default withEve(nextConfig);
