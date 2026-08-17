import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { requireChapterAccess } from "@/lib/chapter-access-server";

import AuthenticatedApp from "./AuthenticatedApp";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  await requireChapterAccess();
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    redirect("/sign-in?redirect_url=%2Fapp");
  }
  const { tab, view } = await searchParams;
  const selectedView = view ?? tab;
  const initialTab = selectedView === "now" ? 1 : selectedView === "together" ? 2 : 0;

  return <AuthenticatedApp initialTab={initialTab} />;
}
