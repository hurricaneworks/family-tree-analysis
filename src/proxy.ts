import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed, devBypass } from "@/lib/supabase";
import { DATABASE } from "@/lib/features";

/**
 * Every request except /login and Next's own assets requires a signed-in, allowlisted user.
 * Also refreshes the Supabase session cookies (the SSR pattern from Supabase's docs).
 */
export async function proxy(request: NextRequest) {
  if (!DATABASE) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        for (const { name, value } of all) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of all) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const ok = devBypass() || Boolean(user && isAllowed(user.email));
  const { pathname } = request.nextUrl;

  // the digest endpoint is called by the database scheduler and carries its own secret
  if (pathname === "/api/digest") return response;
  if (pathname === "/api/reply" && request.headers.has("x-cron-secret")) return response;
  if (pathname === "/login") {
    return ok ? NextResponse.redirect(new URL("/", request.url)) : response;
  }
  if (pathname === "/forgot" || pathname === "/reset") return response;
  if (!ok) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|css|js|map)$).*)"],
};
