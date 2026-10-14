import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  env: { NEXT_PUBLIC_LOCAL_PREVIEW: process.env.VERCEL ? "true" : "false" },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
};
export default config;
