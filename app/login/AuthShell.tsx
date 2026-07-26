import Link from "next/link";

import styles from "./AuthShell.module.css";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Chapter home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.brandMark}
            src="/sidequest-mark.svg"
            alt=""
            width={96}
            height={96}
          />
        </Link>
      </header>

      <section className={styles.content} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>
          {title}
        </h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        <div className={styles.body}>{children}</div>
      </section>
    </main>
  );
}
