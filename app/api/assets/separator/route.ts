import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const possiblePaths = [
    'C:\\Users\\LENOVO\\Downloads\\aep.png',
    path.join(process.cwd(), 'public', 'images', 'aep.png'),
    path.join(process.cwd(), 'public', 'aep.png'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const buffer = fs.readFileSync(p)

        // Make sure it is copied into public/images/aep.png for static hosting / deployment
        const destDir = path.join(process.cwd(), 'public', 'images')
        const destFile = path.join(destDir, 'aep.png')
        if (!fs.existsSync(destFile)) {
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
          fs.writeFileSync(destFile, buffer)
        }

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      } catch (err) {
        console.error('Error reading/serving image:', err)
      }
    }
  }

  return new NextResponse('Image not found', { status: 404 })
}
