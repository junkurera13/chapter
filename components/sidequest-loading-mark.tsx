import Image from "next/image";
import type { CSSProperties } from "react";

import styles from "./sidequest-loading-mark.module.css";

export default function SidequestLoadingMark({
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
          "--sidequest-loading-size": `${size}px`,
        } as CSSProperties
      }
    >
      <Image
        className={styles.mark}
        src="/sidequest-mark.svg"
        alt=""
        width={112}
        height={112}
      />
    </div>
  );
}
