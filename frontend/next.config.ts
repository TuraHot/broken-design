import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
      {
        source: '/((?!embed).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self';" },
        ],
      },
    ];
  },
};

export default nextConfig;

