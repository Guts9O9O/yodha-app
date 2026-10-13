import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInButton } from "@/features/auth/sign-in-button.jsx";
import { getViewer } from "@/server/auth/viewer.js";

export const metadata = { title: "Sign in" };

// Error codes Better Auth passes back as ?error= after the Google callback.
const ERROR_MESSAGES = {
  EMAIL_NOT_ALLOWED:
    "This Google account isn't on the Yoddha Prep list. Sign in with the account you were invited with.",
};
const FALLBACK_ERROR = "Sign-in didn't work. Please try again.";

export default function SignInPage({ searchParams }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Yoddha Prep</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with the Google account on the team list.
        </p>
      </div>
      {/* Reads the session and the URL, so it renders per request inside Suspense. */}
      <Suspense fallback={null}>
        <SignInState searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInState({ searchParams }) {
  if (await getViewer()) redirect("/");

  const { error } = await searchParams;
  const message =
    typeof error === "string"
      ? (ERROR_MESSAGES[error.toUpperCase()] ?? FALLBACK_ERROR)
      : null;

  return (
    <>
      {message && (
        <p
          role="alert"
          className="max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {message}
        </p>
      )}
      <SignInButton />
    </>
  );
}
