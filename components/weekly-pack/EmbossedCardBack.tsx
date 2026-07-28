"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import {
  BubblegumEmbossEngine,
  type BubblegumTone,
} from "./emboss-engine";
import styles from "./EmbossedCardBack.module.css";

export default function EmbossedCardBack({
  number,
  tone,
}: {
  number: string;
  tone: BubblegumTone;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = new BubblegumEmbossEngine(host, { number, tone });
    if (!engine.ok) return () => engine.destroy();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(host);

    function moveLight(event: PointerEvent) {
      if (reduceMotion) return;
      const target = event.currentTarget as HTMLDivElement;
      const bounds = target.getBoundingClientRect();
      engine.setLightFromPointer(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
      );
    }

    function resetLight() {
      if (!reduceMotion) engine.resetLight();
    }

    host.addEventListener("pointermove", moveLight);
    host.addEventListener("pointerleave", resetLight);

    return () => {
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", moveLight);
      host.removeEventListener("pointerleave", resetLight);
      engine.destroy();
    };
  }, [number, tone]);

  return (
    <span
      ref={hostRef}
      className={styles.root}
      data-tone={tone}
      aria-hidden="true"
    >
      <span className={styles.fallbackNumber}>{number}</span>
      <Image
        className={styles.fallbackMark}
        src="/chapter-mark.svg"
        alt=""
        width={112}
        height={112}
      />
    </span>
  );
}
