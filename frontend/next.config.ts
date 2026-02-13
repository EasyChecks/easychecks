import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // For production with Nginx, use static export
  // Uncomment this for Docker production build
  // output: 'export',
  
  // For standalone server (without Nginx)
  output: 'standalone',
  
  // Optionally configure image domains if using next/image
  // images: {
  //   domains: ['your-domain.com'],
  // },
};

export default nextConfig;
