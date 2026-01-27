import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Allow loading images from external sources if needed
  images: {
    domains: [],
  },
};

export default withNextIntl(nextConfig);
