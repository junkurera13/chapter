import Image from "next/image";
import type { CSSProperties } from "react";

import styles from "./chapter-loading-mark.module.css";

export default function ChapterLoadingMark({
  label,
  size = 88,
}: {
  label: string;
  size?: number;
}) {
  return (
    <div
      className={styles.root}
      role="status"
      aria-label={label}
      style={
        {
          "--chapter-loading-size": `${size}px`,
        } as CSSProperties
      }
    >
      <Image
        className={styles.mark}
        src="/chapter-mark.svg"
        alt=""
        width={112}
        height={112}
      />
    </div>
  );
}

