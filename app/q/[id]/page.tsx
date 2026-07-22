import { notFound } from "next/navigation";

import { QuestMission } from "@/components/QuestMission";
import { BASE44_APP_ID } from "@/lib/base44Client";
import { getQuestByShortId } from "@/lib/base44Functions";

export const dynamic = "force-dynamic";

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="text-smooth flex min-h-screen items-center justify-center bg-neutral-950 px-5 text-zinc-100">
      <div className="card-surface max-w-md rounded-2xl p-7">
        <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
          offline
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold tracking-tight text-white">
          convex needs setup
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function QuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!BASE44_APP_ID) {
    return (
      <SetupNotice message="Add NEXT_PUBLIC_CONVEX_URL to .env.local. Convex usually writes this when you run npx convex dev." />
    );
  }

  let quest;

  try {
    quest = await getQuestByShortId({ shortId: id });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Could not fetch this mission file from Convex.";

    return <SetupNotice message={message} />;
  }

  if (!quest) {
    notFound();
  }

  return <QuestMission quest={quest} />;
}
