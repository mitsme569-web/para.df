import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s · paraDF',
    default: 'paraDF — Read Deeper, Remember More',
  },
  description:
    'Your personal reading companion. Upload books, save words, and build a dictionary that grows with every page you read.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="font-poppins antialiased bg-brand-dark text-brand-cream">
        {children}
      </body>
    </html>
  )
}
