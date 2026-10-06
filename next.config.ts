import type { NextConfig } from 'next';

// Studio runs entirely in the browser, so it ships as a static export (`out/`)
// that any static host can serve. Security headers live in public/_headers and vercel.json.
const config: NextConfig = {
  output: 'export',
  devIndicators: false,
  reactStrictMode: true,
};

export default config;
