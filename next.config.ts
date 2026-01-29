import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Ignore TypeScript and ESLint errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Allow loading images from external sources if needed
  images: {
    domains: [],
  },

  // Ignore optional dependencies from ftp-srv/bunyan
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'dtrace-provider': 'dtrace-provider',
        'source-map-support': 'source-map-support',
      });
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
