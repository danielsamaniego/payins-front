import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public checkout — no auth gate. Reserved for future locale routing or
 * lightweight request-level instrumentation. Keep this cheap: it runs on
 * every request that matches `config.matcher`.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
