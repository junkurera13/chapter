import { buildMapSearchUrl } from "@/lib/quest";
import type { QuestRecord } from "@/lib/backendTypes";

export function QuestMission({ quest }: { quest: QuestRecord }) {
  return (
    <main className="text-smooth min-h-screen bg-neutral-950 px-5 py-10 text-zinc-100 sm:px-6 sm:py-14">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="sidequest"
            width={36}
            height={36}
            className="image-pixelated h-9 w-9 shrink-0"
          />
          <p className="font-[family-name:var(--font-vt323)] text-sm uppercase tracking-[0.32em] text-pixel-green">
            sidequest
          </p>
        </header>

        <div className="mt-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            your quest
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            {quest.title}
          </h1>
        </div>

        <section className="card-surface mt-4 rounded-2xl p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-pixel-pink"
            />
            <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
              the plan
            </p>
          </div>
          <p className="mt-3 text-lg leading-relaxed text-zinc-200 sm:text-xl">
            {quest.brief}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          {quest.stops.map((stop, index) => (
            <div
              key={`${stop.name}-${index}`}
              className="card-surface rounded-2xl p-6 sm:p-7"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pixel-yellow font-[family-name:var(--font-pixelify-sans)] text-sm font-bold text-black">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                      {stop.name}
                    </h2>
                    <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.18em] text-pixel-green">
                      {stop.estimatedCost}
                    </span>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300 sm:text-lg">
                    {stop.description}
                  </p>
                  <a
                    href={buildMapSearchUrl(stop.mapSearch)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
                  >
                    open maps
                    <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="card-surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-pixel-green"
              />
              <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-green">
                total
              </p>
            </div>
            <p className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold tracking-tight text-pixel-yellow sm:text-4xl">
              {quest.budget}
            </p>
          </div>
          <div className="card-surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-zinc-500"
              />
              <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-zinc-400">
                backup
              </p>
            </div>
            <p className="mt-3 text-base leading-relaxed text-zinc-200 sm:text-lg">
              {quest.backup}
            </p>
          </div>
        </section>

        <section className="card-surface rounded-2xl p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-pixel-pink"
            />
            <p className="font-[family-name:var(--font-vt323)] text-xs uppercase tracking-[0.3em] text-pixel-pink">
              text a friend
            </p>
          </div>
          <blockquote className="mt-3 border-l-2 border-pixel-pink/60 pl-4 text-lg italic leading-relaxed text-zinc-100 sm:text-xl">
            &ldquo;{quest.inviteText}&rdquo;
          </blockquote>
        </section>

        <footer className="pt-4 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-sm uppercase tracking-[0.32em] text-zinc-500">
            sdqst.fun<span className="pixel-blink text-pixel-pink">_</span>
          </p>
        </footer>
      </article>
    </main>
  );
}
