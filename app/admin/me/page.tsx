import Link from "next/link";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import { BASE44_APP_ID } from "@/lib/base44Client";
import { getUserByPhone, listQuestsByPhone } from "@/lib/base44Functions";
import type { QuestRecord, UserProfile } from "@/lib/backendTypes";

export const dynamic = "force-dynamic";

// Default admin phone for Jun. Override with ?phone=... in the URL, or set
// ADMIN_PHONE in the environment.
const FALLBACK_ADMIN_PHONE = "+821058964319";

function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try parsing as-is (works for E.164 input). If that fails, try the
  // common Korean default since the operator is in Seoul.
  const parsed =
    parsePhoneNumberFromString(trimmed) ??
    parsePhoneNumberFromString(trimmed, "KR");
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(timestamp));
}

function formatRelative(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function MemoryField({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "pink" | "green" | "yellow";
}) {
  const dotColor =
    accent === "pink"
      ? "bg-pixel-pink"
      : accent === "yellow"
        ? "bg-pixel-yellow"
        : accent === "green"
          ? "bg-pixel-green"
          : "bg-zinc-500";

  const labelColor =
    accent === "pink"
      ? "text-pixel-pink"
      : accent === "yellow"
        ? "text-pixel-yellow"
        : accent === "green"
          ? "text-pixel-green"
          : "text-zinc-400";

  return (
    <div>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <p
          className={`font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] ${labelColor}`}
        >
          {label}
        </p>
      </div>
      <div className="mt-2 text-base leading-relaxed text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function emptyValue() {
  return <span className="text-zinc-600">—</span>;
}

function ProfileCard({ profile }: { profile: UserProfile }) {
  const memoryFresh = profile.memoryUpdatedAt
    ? formatRelative(profile.memoryUpdatedAt)
    : "never";

  return (
    <article className="card-surface rounded-2xl p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.32em] text-pixel-pink">
            user profile
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {profile.name ?? "unnamed"}
          </h2>
          <p className="mt-1 font-mono text-sm text-zinc-400">
            {profile.phone}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.18em] ${
              profile.state === "awaiting_followup"
                ? "border-pixel-yellow/40 bg-pixel-yellow/10 text-pixel-yellow"
                : "border-pixel-green/40 bg-pixel-green/10 text-pixel-green"
            }`}
          >
            {profile.state ?? "idle"}
          </span>
          <span className="text-xs text-zinc-500">
            memory updated {memoryFresh}
          </span>
        </div>
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MemoryField
          label="home"
          accent="green"
          value={profile.homeCity ?? emptyValue()}
        />
        <MemoryField
          label="current city"
          accent="yellow"
          value={profile.currentCity ?? emptyValue()}
        />
        <MemoryField
          label="vacation"
          value={
            profile.onVacation === undefined
              ? emptyValue()
              : profile.onVacation
                ? "yes"
                : "no"
          }
        />
        <MemoryField
          label="country"
          value={profile.country ?? emptyValue()}
        />
        <MemoryField
          label="first seen"
          value={
            <span title={formatDate(profile.firstSeenAt)}>
              {formatRelative(profile.firstSeenAt)}
            </span>
          }
        />
        <MemoryField
          label="signed up"
          value={
            profile.signedUpAt
              ? formatRelative(profile.signedUpAt)
              : emptyValue()
          }
        />
        <MemoryField
          label="coords"
          value={
            profile.latitude !== undefined &&
            profile.longitude !== undefined ? (
              <span className="font-mono text-sm text-zinc-300">
                {profile.latitude.toFixed(2)}, {profile.longitude.toFixed(2)}
              </span>
            ) : (
              emptyValue()
            )
          }
        />
      </div>

      <div className="mt-7">
        <MemoryField
          label="notes"
          accent="pink"
          value={
            profile.notes ? (
              <p className="whitespace-pre-wrap text-zinc-200">
                {profile.notes}
              </p>
            ) : (
              <span className="italic text-zinc-500">
                no notes yet. text the agent to start building memory.
              </span>
            )
          }
        />
      </div>

      {profile.pendingRequest && (
        <div className="mt-6 rounded-xl border border-pixel-yellow/40 bg-pixel-yellow/5 p-4">
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-yellow">
            pending request
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">
            {profile.pendingRequest}
          </p>
        </div>
      )}

      {profile.assignedPhone && (
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-[family-name:var(--font-vt323)] uppercase tracking-[0.3em]">
            assigned line
          </span>
          <span className="font-mono">{profile.assignedPhone}</span>
        </div>
      )}
    </article>
  );
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

function QuestHistoryCard({ quest }: { quest: QuestRecord }) {
  return (
    <article className="card-surface rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.18em] text-zinc-300">
              {quest.source ?? "unknown"}
            </span>
            <OutcomeChip outcome={quest.outcome} />
            <span className="text-xs text-zinc-500">
              {formatRelative(quest.createdAt)} ·{" "}
              {formatDate(quest.createdAt)}
            </span>
          </div>
          <h3 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight tracking-tight text-white">
            {quest.title}
          </h3>
        </div>
        <Link
          href={`/q/${quest.shortId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          open
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-500">
            you asked
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
            {quest.initialRequest ?? quest.request}
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

      <details className="group mt-5 border-t border-zinc-800 pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-400 hover:text-zinc-200">
          mission preview
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-zinc-300">{quest.brief}</p>
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
          <p className="text-xs text-zinc-500">
            total {quest.budget} · backup: {quest.backup}
          </p>
        </div>
      </details>
    </article>
  );
}

function NotFoundCard({ phone }: { phone: string }) {
  return (
    <div className="card-surface rounded-2xl p-7">
      <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
        no user yet
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold tracking-tight text-white">
        nothing on file for{" "}
        <span className="font-mono">{phone}</span>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        once this number texts the agent (or signs up at /signup), a user
        record will appear here with everything the agent has learned.
      </p>
    </div>
  );
}

function InvalidPhoneCard({ raw }: { raw: string }) {
  return (
    <div className="card-surface rounded-2xl p-7">
      <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
        bad phone
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold tracking-tight text-white">
        couldn&apos;t parse <span className="font-mono">{raw}</span>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        use E.164 format (e.g. +821058964319) in the ?phone= query string.
      </p>
    </div>
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
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{message}</p>
      </div>
    </main>
  );
}

export default async function AdminMePage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  if (!BASE44_APP_ID) {
    return (
      <SetupNotice message="missing NEXT_PUBLIC_CONVEX_URL. run npx convex dev or set the env var." />
    );
  }

  const { phone: rawParam } = await searchParams;
  const rawInput =
    rawParam?.trim() || process.env.ADMIN_PHONE || FALLBACK_ADMIN_PHONE;
  const normalized = normalizePhone(rawInput);

  return (
    <main className="text-smooth min-h-screen bg-neutral-950 px-5 py-10 text-zinc-100 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.32em] text-pixel-pink">
              sidequest admin
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl">
              my account
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              everything the agent remembers about{" "}
              <span className="font-mono text-zinc-300">
                {normalized ?? rawInput}
              </span>
              .
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <span aria-hidden>←</span>
            all quests
          </Link>
        </div>

        <form className="mt-6 flex max-w-md items-center gap-2" action="">
          <input
            name="phone"
            type="text"
            defaultValue={rawParam ?? ""}
            placeholder="lookup another phone (e.g. +1415…)"
            className="flex-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-pixel-pink"
          />
          <button
            type="submit"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            look up
          </button>
        </form>

        {!normalized ? (
          <div className="mt-10">
            <InvalidPhoneCard raw={rawInput} />
          </div>
        ) : (
          <ProfileSection phone={normalized} />
        )}
      </section>
    </main>
  );
}

async function ProfileSection({ phone }: { phone: string }) {
  let profile: UserProfile | null;
  let quests: QuestRecord[];
  try {
    [profile, quests] = await Promise.all([
      getUserByPhone({ phone }),
      listQuestsByPhone({ phone, limit: 25 }),
    ]);
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "could not reach convex for this lookup.";
    return (
      <div className="mt-10 card-surface rounded-2xl p-7">
        <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
          fetch failed
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{message}</p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-6">
      {profile ? <ProfileCard profile={profile} /> : <NotFoundCard phone={phone} />}

      <div className="flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold tracking-tight text-white">
          quest history
        </h2>
        <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300">
          {quests.length} {quests.length === 1 ? "quest" : "quests"}
        </span>
      </div>

      {quests.length === 0 ? (
        <div className="card-surface rounded-2xl p-7 text-center">
          <p className="text-sm text-zinc-400">
            no quests for this number yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {quests.map((quest) => (
            <QuestHistoryCard key={quest.shortId} quest={quest} />
          ))}
        </div>
      )}
    </div>
  );
}
