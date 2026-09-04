import { getLanIp } from './lib/get-lan-ip.js';

const lanIp = getLanIp();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Auto-detected so accessing the dev server from your phone/other devices
  // keeps working after switching networks — no manual IP updates needed.
  allowedDevOrigins: lanIp ? [lanIp] : [],
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

export default nextConfig;
