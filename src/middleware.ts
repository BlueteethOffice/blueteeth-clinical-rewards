import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard'];
// Public routes that should not be accessible when logged in
const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('session')?.value;

  // 1. 🛡️ Security Headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // 🛡️ Content Security Policy
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://res.cloudinary.com https://api.dicebear.com https://lh3.googleusercontent.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.emailjs.com https://api.resend.com; frame-src 'self'; object-src 'none';");
  
  // 2. 🔐 Route Protection
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));

  if (isProtectedRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Removing auto-redirect from /login to /dashboard to prevent infinite loops 
  // with stale session cookies. The LoginPage component will handle this if needed.
  /*
  if (isAuthRoute && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  */

  // 🛡️ RBAC Enforcement
  if (isProtectedRoute && session) {
    try {
      // In a real app, the role should be in the session cookie as a custom claim
      // for microsecond performance. Here we'll check the path as a proxy 
      // or assume the role-specific route protection is handled by components if session is opaque.
      // But let's add a basic check:
      const role = request.cookies.get('user_role')?.value; // Insecure if used alone, but good for UI routing
      
      if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      if (pathname.startsWith('/dashboard/clinician') && role !== 'clinician' && role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      if (pathname.startsWith('/dashboard/associate') && role !== 'associate' && role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (e) {
      console.error('Middleware RBAC Error:', e);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\..*).*)',
    '/dashboard/:path*',
  ],
};
