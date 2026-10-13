import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  let origin = requestUrl.origin
  // Next dev can normalize request.url to localhost for a 127.0.0.1 request.
  // Keep the browser's loopback host so PKCE/session cookies stay on that host.
  const localHost = request.headers.get('host')
  if (process.env.NODE_ENV === 'development' && localHost &&
      /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i.test(localHost)) {
    try {
      origin = new URL(`${requestUrl.protocol}//${localHost}`).origin
    } catch {
      // An invalid port cannot replace the framework-provided origin.
    }
  }
  const code = searchParams.get('code')
  const flowId = searchParams.get('sb_flow_id')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(
      code, flowId ? { flowId } : undefined
    )
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
