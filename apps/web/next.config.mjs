import { readFileSync } from "node:fs";

// Duplicate pages merged into one canonical page; see src/content/merged-pages.json.
const mergedPages = JSON.parse(readFileSync(new URL("./src/content/merged-pages.json", import.meta.url), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker builds emit a dependency-traced runtime bundle instead of copying
  // the whole workspace. Regular local Windows builds keep Next's default
  // output because creating pnpm trace symlinks requires Developer Mode.
  output: process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
  images: {
    // Resized copies are kept a week rather than Next's default minute: on a
    // slow link every revalidation is another round trip. Images whose
    // content can change under the same path are served unoptimized.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async redirects() {
    // 301 rather than Next's default 308: the classic permanent redirect every crawler handles.
    return mergedPages.redirects.map(({ from, to }) => ({ source: from, destination: to, statusCode: 301 }));
  },
  async rewrites() {
    const apiOrigin = (process.env.INTERNAL_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
