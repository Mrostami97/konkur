/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker builds emit a dependency-traced runtime bundle instead of copying
  // the whole workspace. Regular local Windows builds keep Next's default
  // output because creating pnpm trace symlinks requires Developer Mode.
  output: process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
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
