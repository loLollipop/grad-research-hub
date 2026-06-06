import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, hasValidAccessCookie, isAccessControlEnabled } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  if (!isAccessControlEnabled()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const signed = request.cookies.get(ACCESS_COOKIE)?.value;
  if (await hasValidAccessCookie(signed)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
