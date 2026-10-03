import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Legacy login links now open the automatic Admin workspace entry.
  if (pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next") || "/";
    const safe = next.startsWith("/") && !next.startsWith("//") &&
      !next.includes("\\") && !next.startsWith("/login");
    return NextResponse.redirect(new URL(safe ? next : "/", request.url));
  }
  if (pathname === "/submit-report")
    return NextResponse.next();
  // The public shell establishes an isolated Admin preview session on entry.
  // All data APIs still enforce their own session and read-only permissions.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/|favicon\\.svg$).*)"],
};
