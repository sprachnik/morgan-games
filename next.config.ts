import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repoBase = "/morgan-games";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? repoBase : "",
  assetPrefix: isProd ? `${repoBase}/` : "",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? repoBase : "",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
