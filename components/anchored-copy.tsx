"use client";

import { useMemo } from "react";

import { categoryOrbGradient } from "../app/app/categoryAppearance";
import type { WorldNodeCategory } from "../app/app/graphData";
import styles from "./anchored-copy.module.css";

/**
 * An anchor as one reader sees it. In Now every anchor is the reader's own and
 * always carries a node id. In Together an anchor can belong to the other
 * person's world, and arrives without one — so it reads as plain words rather
 * than lighting up as a memory this reader never had.
 */
export type CopyAnchor = {
  label: string;
  category: string;
  nodeId?: string;
};

const KNOWN_CATEGORIES: readonly WorldNodeCategory[] = [
  "experience",
  "people",
  "place",
  "activity",
  "interest",
  "feeling",
  "condition",
  "pattern",
];

function orbCategory(category: string): WorldNodeCategory {
  return (
    KNOWN_CATEGORIES.includes(category as WorldNodeCategory)
      ? category
      : "pattern"
  ) as WorldNodeCategory;
}

/**
 * Renders composed copy with the reader's own graph anchors as inline orb
 * chips. Anchor labels appear verbatim in the text by contract with the
 * composer, so the split is exact rather than fuzzy.
 */
export default function AnchoredCopy({
  text,
  anchors,
}: {
  text: string;
  anchors: readonly CopyAnchor[];
}) {
  const parts = useMemo(() => {
    const sorted = [...anchors].sort(
      (first, second) => second.label.length - first.label.length,
    );
    let segments: Array<{ text: string; anchor?: CopyAnchor }> = [{ text }];
    for (const anchor of sorted) {
      segments = segments.flatMap((segment) => {
        if (segment.anchor) return [segment];
        const pieces = segment.text.split(anchor.label);
        if (pieces.length === 1) return [segment];
        const next: Array<{ text: string; anchor?: CopyAnchor }> = [];
        pieces.forEach((piece, index) => {
          if (index > 0) next.push({ text: anchor.label, anchor });
          if (piece) next.push({ text: piece });
        });
        return next;
      });
    }
    return segments;
  }, [text, anchors]);

  return (
    <>
      {parts.map((part, index) =>
        part.anchor?.nodeId ? (
          <span className={styles.anchor} key={`${part.text}-${index}`}>
            <span
              className={styles.anchorOrb}
              style={{
                background: categoryOrbGradient(
                  orbCategory(part.anchor.category),
                ),
              }}
              aria-hidden="true"
            />
            {part.text}
          </span>
        ) : (
          <span key={`plain-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}
