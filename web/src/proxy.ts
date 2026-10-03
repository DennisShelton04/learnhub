import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirects based on the session cookie only.
// Pages still verify the session on the server before showing data.
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname, search } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!hasSession && !isAuthPage) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/communities/:path*", "/c/:path*", "/join/:path*", "/login", "/signup"],
};
