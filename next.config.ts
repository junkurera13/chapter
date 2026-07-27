import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    qualities: [75, 90],
  },
};

// Eve's local sandbox can be expensive and is not required for onboarding
// memory extraction. Keep ordinary local development isolated from it; the
// production build still includes Eve for experience planning and messaging.
const enableEve =
  process.env.CHAPTER_DISABLE_EVE !== "1" &&
  (process.env.NODE_ENV === "production" ||
    process.env.CHAPTER_ENABLE_LOCAL_EVE === "1");

export default enableEve ? withEve(nextConfig) : nextConfig;
