"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "./auth-client.js";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    // On success the browser leaves for Google; errors from the callback come back as ?error=.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/sign-in",
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="h-12 min-w-60 px-6 text-base"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t start sign-in. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
