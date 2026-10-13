import { Suspense } from "react";
import { SignOutButton } from "@/features/auth/sign-out-button.jsx";
import { requireViewer } from "@/server/auth/viewer.js";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Yoddha Prep</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">
            Checking your session…
          </p>
        }
      >
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const viewer = await requireViewer();
  return (
    <>
      <p className="max-w-sm text-sm">
        Signed in as <span className="font-medium">{viewer.name}</span> (
        {viewer.email}).
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {viewer.athlete
          ? `Athlete profile: ${viewer.athlete.displayName}. Training, meals and check-ins arrive in the next milestones.`
          : "No athlete profile yet. Onboarding arrives in the next milestone."}
      </p>
      <SignOutButton />
    </>
  );
}
