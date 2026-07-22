"use client";

import { useState } from "react";

import { getBase44GoogleLoginUrl } from "@/lib/base44BrowserClient";

export function GoogleLoginButton() {
  const [leaving, setLeaving] = useState(false);

  function signIn() {
    setLeaving(true);
    const returnUrl = new URL("/app", window.location.origin).toString();
    window.location.assign(getBase44GoogleLoginUrl(returnUrl));
  }

  return (
    <button
      type="button"
      className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-black px-6 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
      onClick={signIn}
      disabled={leaving}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 5-.9 6.8-2.3l-3.3-2.6c-.9.6-2.1 1-3.5 1a6 6 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.4 14a6 6 0 0 1 0-3.9V7.4H3a10 10 0 0 0 0 9.3L6.4 14Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.9c1.6 0 3 .5 4.2 1.6l3.1-3.1A10 10 0 0 0 3 7.4l3.4 2.7A6 6 0 0 1 12 6Z"
        />
      </svg>
      <span>{leaving ? "Opening Google…" : "Continue with Google"}</span>
    </button>
  );
}
