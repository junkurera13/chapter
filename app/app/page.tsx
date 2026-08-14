import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { requireChapterAccess } from "@/lib/chapter-access-server";

import AuthenticatedApp from "./AuthenticatedApp";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireChapterAccess();
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    redirect("/sign-in?redirect_url=%2Fapp");
  }
  const { tab } = await searchParams;

  return <AuthenticatedApp initialTab={tab === "together" ? 2 : 1} />;
}
