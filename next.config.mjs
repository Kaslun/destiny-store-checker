/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Bungie serves item icons/screenshots from absolute URLs on this host.
    remotePatterns: [
      { protocol: "https", hostname: "www.bungie.net" },
    ],
  },
  // Belt-and-braces: the bundle grep in scripts/check-client-bundle.mjs is the
  // real gate, but documenting intent here too.
  experimental: {},
};
export default nextConfig;
