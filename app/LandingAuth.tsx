"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import AuthModal from "./login/AuthModal";

type LandingAuthContextValue = {
  openAuth: () => void;
};

const LandingAuthContext = createContext<LandingAuthContextValue | null>(null);

export function useLandingAuth() {
  const value = useContext(LandingAuthContext);
  if (!value) {
    throw new Error("useLandingAuth must be used within LandingAuthProvider");
  }
  return value;
}

export function LandingAuthProvider({
  children,
  initialOpen = false,
}: {
  children: React.ReactNode;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authParam = searchParams.get("auth");
  const [manualOpen, setManualOpen] = useState(initialOpen);
  const open = manualOpen || authParam === "1";

  const clearAuthParam = useCallback(() => {
    if (authParam !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname || "/", {
      scroll: false,
    });
  }, [authParam, pathname, router, searchParams]);

  const openAuth = useCallback(() => {
    setManualOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setManualOpen(false);
    clearAuthParam();
  }, [clearAuthParam]);

  const value = useMemo(() => ({ openAuth }), [openAuth]);

  return (
    <LandingAuthContext.Provider value={value}>
      {children}
      <AuthModal open={open} onClose={closeAuth} />
    </LandingAuthContext.Provider>
  );
}

export function AuthOpenButton({
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { openAuth } = useLandingAuth();
  return (
    <button
      type={type}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openAuth();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
