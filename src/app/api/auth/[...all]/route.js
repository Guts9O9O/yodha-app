import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth.js";

// Better Auth endpoints (Google sign-in, callback, session, sign-out).
// The instance is created on first request, so `next build` doesn't need auth secrets.

export async function GET(request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request) {
  return toNextJsHandler(getAuth()).POST(request);
}
