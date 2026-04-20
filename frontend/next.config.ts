import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: false, // Disabled for dev to reduce memory usage
  output: 'standalone',
  productionBrowserSourceMaps: false,

  // อนุญาตให้ next/image โหลดรูปจาก Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Proxy /api-local/* → backend container
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:3001';
    return [
      {
        source: '/api-local/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  
  // Experimental features that can reduce memory
  experimental: {
    optimizePackageImports: ['@/'],
  },
};

export default nextConfig;
