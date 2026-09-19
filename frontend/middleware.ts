import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/submit-report")
    return NextResponse.next();
  let authenticated = false;
  if (request.cookies.has("byteforce_session")) {
    try {
      const response = await fetch(
        `${process.env.API_INTERNAL_URL || "http://127.0.0.1:8000"}/api/auth/me`,
        {
          headers: {
            Cookie: `byteforce_session=${request.cookies.get("byteforce_session")!.value}`,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );
      authenticated = response.ok;
    } catch {
      /* Fail closed; the login screen offers retry/password access. */
    }
  }
  if (authenticated) return NextResponse.next();
  const destination = new URL("/login", request.url);
  destination.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/|favicon\\.svg$).*)"],
};
