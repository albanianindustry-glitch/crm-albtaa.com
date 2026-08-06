/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run separately in CI; don't block builds on it here.
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
