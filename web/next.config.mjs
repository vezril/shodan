/** @type {import('next').NextConfig} */
const nextConfig = {
  // The contract is shipped as TypeScript source; let Next compile it.
  transpilePackages: ["@shodan/contract"],
  // Dev proxy: the cockpit calls /api/* same-origin and Next forwards to the
  // daemon. In production the daemon serves the built UI, so /api/* is already
  // same-origin — the client code is identical in both.
  async rewrites() {
    const daemon = process.env.DAEMON_URL ?? "http://127.0.0.1:4317";
    return [{ source: "/api/:path*", destination: `${daemon}/api/:path*` }];
  },
};

export default nextConfig;
