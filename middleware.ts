import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken, COOKIE_NAME } from './lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static assets, next internals, and public auth endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/login') ||
    pathname === '/api/auth/pin' ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const isValid = await verifySessionToken(token)

  if (!isValid) {
    // If it's an API route, return 401 JSON response
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized. PIN required.' }, { status: 401 })
    }

    // For pages, redirect to /login with return URL
    const loginUrl = new URL('/login', req.url)
    if (pathname !== '/' && pathname !== '/books') {
      loginUrl.searchParams.set('from', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // If already authenticated and visiting /login, forward to /books
  if (isValid && pathname === '/login') {
    return NextResponse.redirect(new URL('/books', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
