"use client";

import { useState } from "react";
import Link from "next/link";

import { BASE44_APP_ID } from "@/lib/base44Client";
import { generateQuest } from "@/lib/base44Functions";

const exampleRequest =
  "I'm free tonight in Seoul, ₩30k budget, solo, surprise me.";

export function QuestGenerator() {
  const client = BASE44_APP_ID;
  const [request, setRequest] = useState(exampleRequest);
  const [result, setResult] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!client) {
      setError("missing NEXT_PUBLIC_CONVEX_URL. run npx convex dev first.");
      return;
    }

    if (request.trim().length < 8) {
      setError("need more intel before dispatch.");
      return;
    }

    setIsLoading(true);

    try {
      const generated = await generateQuest({
        request: request.trim(),
        source: "admin",
      });
      setResult(generated);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "mission printer jammed. try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="text-smooth mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-10 text-zinc-100 sm:px-8 sm:py-14">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.32em] text-pixel-pink">
            sidequest admin
          </p>
          <h1 className="mt-3 break-words font-[family-name:var(--font-pixelify-sans)] text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl">
            manual dispatch
          </h1>
        </div>
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          <span aria-hidden>←</span>
          recent quests
        </Link>
      </div>

      <div className="mt-10 grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={handleSubmit}
          className="card-surface min-w-0 rounded-2xl p-6 sm:p-7"
        >
          <label
            htmlFor="request"
            className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-400"
          >
            incoming text
          </label>
          <textarea
            id="request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={8}
            className="mt-3 w-full min-w-0 resize-none rounded-xl border border-zinc-700 bg-neutral-950/60 p-4 text-base leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-pixel-pink focus:bg-neutral-950 sm:text-lg"
            placeholder={exampleRequest}
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-pixel-pink px-5 py-3.5 text-base font-semibold text-black transition-colors hover:bg-pixel-pink/90 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isLoading ? (
              <>
                <span
                  aria-hidden
                  className="h-2 w-2 animate-pulse rounded-full bg-black"
                />
                dispatching…
              </>
            ) : (
              <>
                generate quest
                <span aria-hidden>→</span>
              </>
            )}
          </button>
        </form>

        <aside className="card-surface min-w-0 rounded-2xl p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-pixel-green"
            />
            <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-green">
              operator notes
            </p>
          </div>

          {!isLoading && !error && !result && (
            <div className="mt-5 space-y-4">
              <p className="font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold tracking-tight text-white">
                test the quest brain.
              </p>
              <p className="text-sm leading-relaxed text-zinc-400">
                paste a user request exactly how they&apos;d send it via text.
                output saves as an admin-source quest so it doesn&apos;t mix
                with real traffic.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-pixel-green/40 bg-pixel-green/5 px-4 py-3.5 text-sm text-pixel-green">
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full bg-pixel-green"
              />
              consulting mission desk…
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-pixel-pink/40 bg-pixel-pink/5 px-4 py-3.5">
              <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
                error
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-pixel-pink">
                {error}
              </p>
            </div>
          )}

          {result && (
            <div className="mt-5 space-y-3 rounded-xl border border-pixel-green/40 bg-pixel-green/5 p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-pixel-green"
                />
                <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-green">
                  mission ready
                </p>
              </div>
              <a
                href={result.url}
                className="block break-all font-[family-name:var(--font-pixelify-sans)] text-xl font-bold tracking-tight text-white underline decoration-pixel-green decoration-2 underline-offset-4 transition-colors hover:text-pixel-green"
              >
                {result.url}
              </a>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
