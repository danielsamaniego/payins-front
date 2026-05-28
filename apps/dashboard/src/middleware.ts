import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "payins_admin_session";
const PUBLIC_PATHS = ["/login", "/api/auth"];

/**
 * Auth gate. Routes outside `PUBLIC_PATHS` require a session cookie. The cookie
 * is set by the login server action after a successful `/v1/admin/login`
 * roundtrip to the backend's `iam` feature.
 *
 * STATUS: stub. Today it only checks that the cookie EXISTS — it does NOT yet
 * validate the token against the backend. Tighten this when `iam` lands
 * (Phase 2b per `PAYINS_SERVICE_PLAN.md` §15).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
