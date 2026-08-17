import "server-only";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export async function authenticatedConvexClient() {
  const { isAuthenticated, getToken } = await auth();
  if (!isAuthenticated) return null;
  const token = await getToken({ template: "convex" });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!token || !convexUrl) return null;

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}
