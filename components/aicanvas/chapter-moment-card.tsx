import type { CSSProperties, ReactNode } from "react";

import { categoryOrbGradient } from "@/app/app/categoryAppearance";
import type { WorldNodeCategory } from "@/app/app/graphData";

interface ChapterMomentCardContentProps {
  alt?: string;
  copy: ReactNode;
  image: string;
  imageAspectRatio?: CSSProperties["aspectRatio"];
  imagePosition?: CSSProperties["objectPosition"];
  priority?: boolean;
}

interface ChapterMomentCardProps extends ChapterMomentCardContentProps {
  ariaLabel: string;
}

export function ChapterMomentCard({
  ariaLabel,
  ...contentProps
}: ChapterMomentCardProps) {
  return (
    <article
      aria-label={ariaLabel}
      className="relative flex w-[320px] flex-col rounded-[18px] bg-white p-2.5 ring-1 ring-black/[0.08]"
      style={{
        boxShadow:
          "0 24px 48px rgba(0,0,0,0.28), 0 6px 14px rgba(0,0,0,0.16)",
      }}
    >
      <ChapterMomentCardContent {...contentProps} />
    </article>
  );
}

export function ChapterMomentCardContent({
  alt = "",
  copy,
  image,
  imageAspectRatio,
  imagePosition = "center",
  priority = false,
}: ChapterMomentCardContentProps) {
  return (
    <>
      <div className="relative px-3 pb-4 pt-3">
        <p className="m-0 font-[family-name:var(--font-chapter-sans)] text-[18px] font-normal leading-[1.32] tracking-[-0.025em] text-[#77716f]">
          {copy}
        </p>
      </div>
      <div
        className="relative min-h-0 w-full flex-1 overflow-hidden"
        style={{
          aspectRatio: imageAspectRatio,
          borderRadius: 10,
          flex: imageAspectRatio ? "0 0 auto" : undefined,
        }}
      >
        {/* The landing card intentionally uses the original image bytes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: imagePosition }}
        />
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(50,30,24,0.16))]"
          aria-hidden="true"
        />
      </div>
    </>
  );
}

export function CategoryAnchor({
  category,
  children,
}: {
  category: WorldNodeCategory;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
      <span
        className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
        style={{
          background: categoryOrbGradient(category),
          boxShadow:
            "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
        }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export function PlaceAnchor({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
      >
        <path
          fill="#e5484d"
          d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
        />
        <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
      </svg>
      {children}
    </span>
  );
}

export function TimeAnchor({ children }: { children: ReactNode }) {
  return (
    <span className="underline decoration-[#77716f]/70 decoration-1 underline-offset-2">
      {children}
    </span>
  );
}
