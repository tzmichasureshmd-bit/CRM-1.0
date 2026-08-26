import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[MIDDLEWARE] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth middleware is non-functional.',
    )
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes the new cookies onto
  // `supabaseResponse` via setAll() above. Any response we return in
  // place of `supabaseResponse` (every redirect / JSON branch below)
  // is a fresh object that does NOT carry those Set-Cookie headers, so
  // the rotated token never reaches the browser. The next request then
  // replays the old, now-consumed refresh token, the refresh fails, and
  // the session wedges — the user gets a broken reload after idling and
  // can only recover by manually clearing cookies (issue #288). Copy the
  // refreshed cookies onto whatever response we hand back to fix that.
  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // Server actions are POST requests with the Next-Action header.
  // They must never be redirected — a redirect would prevent the
  // server action from executing (e.g. verifySuperAdminRole after
  // signInWithPassword on /super-admin/login).
  const isServerAction = request.method === 'POST' && request.headers.has('Next-Action');

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (user && !isServerAction && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    const inviteToken = request.nextUrl.searchParams.get('invite')
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
      url.search = ''
    } else {
      url.pathname = '/dashboard'
      url.search = ''
    }
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Super admin login page — redirect to /super-admin if already logged in
  // (skip for server actions — they must reach their handler)
  if (user && !isServerAction && request.nextUrl.pathname === '/super-admin/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/super-admin'
    url.search = ''
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Protected pages - redirect to login if not authenticated.
  // /admin/* (except /admin/login) redirects to /admin/login.
  // /super-admin/* (except /super-admin/login) redirects to /super-admin/login.
  if (!user) {
    const pathname = request.nextUrl.pathname
    const isProtectedSuperAdmin = pathname.startsWith('/super-admin') && pathname !== '/super-admin/login'
    const isProtectedAdmin = pathname.startsWith('/admin') && pathname !== '/admin/login'
    const isOtherProtected = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/save-money', '/settings'].some(path => pathname.startsWith(path))
    if (isProtectedSuperAdmin || isProtectedAdmin || isOtherProtected) {
      const url = request.nextUrl.clone()
      if (isProtectedSuperAdmin) {
        url.pathname = '/super-admin/login'
      } else if (isProtectedAdmin) {
        url.pathname = '/admin/login'
      } else {
        url.pathname = '/login'
      }
      url.search = ''
      return withRefreshedCookies(NextResponse.redirect(url))
    }
  }

  // API routes that need auth (not webhooks)
  if (!user && request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook')) {
    return withRefreshedCookies(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
  }

  // Super admin API routes — require authenticated user
  // (actual super_admin check happens in the route handler via requireSuperAdmin)
  if (request.nextUrl.pathname.startsWith('/api/admin/') && !user) {
    return withRefreshedCookies(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
