import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";

// UX only: visitors without a session cookie go straight to /sign-in instead of loading a page
// that would redirect anyway. This is NOT a security boundary: the cookie isn't validated here,
// and every page and Server Action checks the session itself (docs/ARCHITECTURE.md §4.1).
export function proxy(request) {
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  // Everything except the sign-in page, the auth API, Next internals and static files.
  matcher: [
    "/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
