import Link from "next/link";

import { BASE44_APP_ID } from "@/lib/base44Client";
import { listRecentQuests } from "@/lib/base44Functions";
import type { QuestRecord } from "@/lib/backendTypes";

export const dynamic = "force-dynamic";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(timestamp));
}

function labelForSource(source: QuestRecord["source"]) {
  if (!source) return "unknown";
  return source;
}

function sourceAccent(source: QuestRecord["source"]) {
  switch (source) {
    case "imessage":
      return "text-pixel-green border-pixel-green/40 bg-pixel-green/10";
    case "admin":
      return "text-pixel-pink border-pixel-pink/40 bg-pixel-pink/10";
    case "terminal":
      return "text-pixel-yellow border-pixel-yellow/40 bg-pixel-yellow/10";
    default:
      return "text-zinc-300 border-zinc-700 bg-zinc-800/60";
  }
}

function OutcomeChip({ outcome }: { outcome: QuestRecord["outcome"] }) {
  if (!outcome) return null;
  const style =
    outcome === "won"
      ? "text-pixel-green border-pixel-green/40 bg-pixel-green/10"
      : outcome === "lost"
        ? "text-pixel-pink border-pixel-pink/40 bg-pixel-pink/10"
        : "text-zinc-300 border-zinc-700 bg-zinc-800/60";
  const label =
    outcome === "won" ? "W" : outcome === "lost" ? "L" : "skipped";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.18em] ${style}`}
    >
      {label}
    </span>
  );
}

function QuestRow({ quest }: { quest: QuestRecord }) {
  const initial = quest.initialRequest ?? quest.request;

  return (
    <article className="card-surface rounded-2xl p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.18em] ${sourceAccent(
                quest.source,
              )}`}
            >
              {labelForSource(quest.source)}
            </span>
            <OutcomeChip outcome={quest.outcome} />
            <span className="text-xs text-zinc-500">
              {formatDate(quest.createdAt)}
            </span>
          </div>

          <h2 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {quest.title}
          </h2>

          <p className="mt-2 font-mono text-xs text-zinc-500">
            {quest.phone ?? "no phone linked"}
          </p>
        </div>

        <Link
          href={`/q/${quest.shortId}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          open
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-500">
            initial
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
            {initial}
          </p>
        </div>

        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-500">
            follow-up
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {quest.followupAnswer ?? "—"}
          </p>
        </div>
      </div>

      <details className="group mt-6 border-t border-zinc-800 pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-400 transition-colors hover:text-zinc-200">
          mission preview
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-zinc-300">
            {quest.brief}
          </p>
          <ol className="space-y-1.5">
            {quest.stops.map((stop, index) => (
              <li
                key={`${quest.shortId}-${index}`}
                className="flex items-baseline gap-3 text-sm text-zinc-200"
              >
                <span className="font-[family-name:var(--font-vt323)] text-xs text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{stop.name}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-pixel-green">{stop.estimatedCost}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </article>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="text-smooth flex min-h-screen items-center justify-center bg-neutral-950 px-5 text-zinc-100">
      <div className="card-surface mx-auto max-w-md rounded-2xl p-7">
        <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
          admin offline
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold tracking-tight text-white">
          something&apos;s missing
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  if (!BASE44_APP_ID) {
    return (
      <SetupNotice message="missing NEXT_PUBLIC_CONVEX_URL. run npx convex dev or set the env var." />
    );
  }

  let quests: QuestRecord[];

  try {
    quests = await listRecentQuests({ limit: 50 });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "could not load recent quests from convex.";
    return <SetupNotice message={message} />;
  }

  return (
    <main className="text-smooth min-h-screen bg-neutral-950 px-5 py-10 text-zinc-100 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.32em] text-pixel-pink">
              sidequest admin
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl">
              recent quests
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
              {quests.length} shown
            </span>
            <Link
              href="/admin/me"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
            >
              my account
            </Link>
            <Link
              href="/admin/generate"
              className="inline-flex items-center gap-1.5 rounded-full bg-pixel-pink px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-pixel-pink/90"
            >
              new dispatch
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4">
          {quests.length === 0 ? (
            <div className="card-surface rounded-2xl p-8 text-center">
              <p className="font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold tracking-tight text-white">
                no quests yet
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                they&apos;ll show up here as soon as someone texts in.
              </p>
            </div>
          ) : (
            quests.map((quest) => (
              <QuestRow key={quest.shortId} quest={quest} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
