import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // pdfjs-dist has native node bindings we don't want bundled server-side
  serverExternalPackages: ['pdfjs-dist'],
}

export default nextConfig
