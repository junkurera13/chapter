import Link from "next/link";

import Magnet from "@/components/Magnet";

export function TextSidequestButton() {
  return (
    <Magnet padding={120} magnetStrength={3}>
      <Link
        href="/signup"
        className="group inline-flex items-center gap-4 border-4 border-black bg-pixel-pink px-8 py-5 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black transition-transform active:translate-x-0 active:translate-y-0 sm:text-3xl pixel-shadow-black"
      >
        text sidequest
        <span aria-hidden className="text-3xl">
          →
        </span>
      </Link>
    </Magnet>
  );
}
