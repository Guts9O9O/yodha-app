import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loadViewer } from "../dal/viewer.js";
import { isEmailAllowed } from "./allowlist.js";
import { getAllowlist, getAuth } from "./auth.js";

// Who is signed in, for pages and Server Actions (docs/ARCHITECTURE.md §4.1–4.2).
// Every page and action checks for itself; proxy.js is only a UX redirect, and layouts don't
// re-run on navigation, so they never guard anything.

/**
 * The viewer for this request, or null. Cached per request. The allowlist is re-checked every
 * time, so an email removed from ALLOWED_EMAILS loses access even with a live session.
 * @returns {Promise<Readonly<import("../dal/viewer.js").Viewer> | null>}
 */
export const getViewer = cache(async () => {
  // Read the request first: during prerendering this is where rendering stops, so the auth
  // instance (and its secrets) is only touched for real requests.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;
  if (!isEmailAllowed(getAllowlist(), session.user.email)) return null;
  return loadViewer(session.user);
});

/** The viewer, or a redirect to sign-in. Use at the top of every protected page and action. */
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}
