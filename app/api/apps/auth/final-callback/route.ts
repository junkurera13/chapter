import { NextResponse, type NextRequest } from "next/server";

import {
  BASE44_AUTH_RETURN_COOKIE,
  safeBase44AuthReturnPath,
} from "@/lib/base44AuthReturn";

const PRODUCTION_APP_ORIGIN = "https://sidequest-b44.vercel.app";

export function GET(request: NextRequest) {
  const savedReturnPath = request.cookies.get(BASE44_AUTH_RETURN_COOKIE)?.value;
  let decodedReturnPath: string | undefined;
  try {
    decodedReturnPath = savedReturnPath
      ? decodeURIComponent(savedReturnPath)
      : undefined;
  } catch {
    decodedReturnPath = undefined;
  }
  const returnPath = safeBase44AuthReturnPath(
    decodedReturnPath,
  );
  const destination = new URL(returnPath || "/app", PRODUCTION_APP_ORIGIN);

  // Base44 completes provider authentication on its own domain, then sends the
  // resulting session token through this app-local endpoint. Forward the
  // callback parameters once so the app's auth gate can persist the token and
  // immediately remove it from the address bar.
  destination.search = request.nextUrl.search;

  const response = NextResponse.redirect(destination);
  if (savedReturnPath) {
    response.cookies.delete(BASE44_AUTH_RETURN_COOKIE);
  }
  return response;
}
