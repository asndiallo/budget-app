/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.20.10.3'],
  // Keep pdfjs-dist as an external so Next.js doesn't bundle it — the legacy
  // build requires Node.js APIs that can't run in the browser bundle.
  serverExternalPackages: ['pdfjs-dist'],
  /**
   * optimizePackageImports — tells Next.js to only compile the specific exports you import from recharts, r
   * eact-day-picker, and date-fns instead of their entire barrel files. recharts in particular
   * re-exports hundreds of D3 sub-modules which is the most likely cause of the 11 GB heap.
   */
  // experimental: {
  //   optimizePackageImports: ['recharts', 'react-day-picker', 'date-fns'],
  // },
};

module.exports = nextConfig;
