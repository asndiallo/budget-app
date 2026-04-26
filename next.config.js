/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.20.10.3'],
  // Keep pdfjs-dist as an external so Next.js doesn't bundle it — the legacy
  // build requires Node.js APIs that can't run in the browser bundle.
  serverExternalPackages: ['pdfjs-dist'],
};

module.exports = nextConfig;
