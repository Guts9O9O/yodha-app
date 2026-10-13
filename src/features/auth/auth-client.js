import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client. Only for client components (sign-in and sign-out buttons);
// it talks to /api/auth on the same origin. Never use it to decide what data a user may see.
export const authClient = createAuthClient();
