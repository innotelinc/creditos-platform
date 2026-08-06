import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/reports", "/disputes", "/letters", "/documents", "/crm", "/admin", "/billing", "/settings"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("access_token")?.value);

  if (AUTH_PAGES.some((p) => pathname === p) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSession) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/reports/:path*",
    "/disputes/:path*",
    "/letters/:path*",
    "/documents/:path*",
    "/crm/:path*",
    "/admin/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
