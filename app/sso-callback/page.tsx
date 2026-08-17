import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

import { requireChapterAccess } from "@/lib/chapter-access-server";

export default async function SsoCallbackPage() {
  await requireChapterAccess();

  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/app"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/app"
      signUpUrl="/sign-up"
    />
  );
}
