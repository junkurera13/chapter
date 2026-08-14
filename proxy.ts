import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk keeps sessions available to server resources. The private Chapter
// access check lives inside each gated page so URL matching cannot drift from
// the resource it protects.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
