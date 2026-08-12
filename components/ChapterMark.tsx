import Image from "next/image";
import styles from "./ChapterMark.module.css";

type ChapterMarkProps = {
  className?: string;
  label?: string;
};

export function ChapterMark({ className, label }: ChapterMarkProps) {
  return (
    <span
      className={`${styles.crop}${className ? ` ${className}` : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Image
        className={styles.image}
        src="/chapter-mark.svg"
        alt=""
        width={108}
        height={108}
        priority
      />
    </span>
  );
}
