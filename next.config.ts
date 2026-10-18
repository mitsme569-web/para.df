import type { NextConfig } from 'next'
import fs from 'fs'
import path from 'path'

// Sync local separator image to public/images for static serving & Vercel deployment
try {
  const localSrc = 'C:\\Users\\LENOVO\\Downloads\\aep.png'
  const targetDir = path.join(process.cwd(), 'public', 'images')
  const targetFile = path.join(targetDir, 'aep.png')
  if (fs.existsSync(localSrc) && !fs.existsSync(targetFile)) {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    fs.copyFileSync(localSrc, targetFile)
  }
} catch {}

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
