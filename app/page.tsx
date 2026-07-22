import Image from "next/image";
import Link from "next/link";

import heroImage from "@/app/assets/sidequest-coast.jpg";
import { SidequestWordmark } from "@/components/SidequestWordmark";

import styles from "./page.module.css";

const PREFILLED_MESSAGE = "hey";

function getStartHref() {
  const phone = process.env.NEXT_PUBLIC_SIDEQUEST_PHONE?.trim();

  return phone
    ? `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`
    : "/signup";
}

export default function Home() {
  const startHref = getStartHref();

  return (
    <main className={styles.page}>
      <Image
        src={heroImage}
        alt=""
        className={styles.image}
        fill
        priority
        placeholder="blur"
        sizes="100vw"
      />
      <div className={styles.wash} aria-hidden="true" />

      <header className={styles.header}>
        <SidequestWordmark className={styles.wordmark} />
      </header>

      <div className={styles.content}>
        <h1 className={styles.title}>
          Experiences that feel strangely meant for you.
        </h1>
        <p className={styles.body}>
          Sidequest is an agent that turns a memory and a free afternoon into
          one real-world experience — composed for you, not recommended at you.
        </p>
        <div className={styles.actions}>
          <a href={startHref} className={styles.action}>
            Text Sidequest
          </a>
          <Link href="/app" className={styles.appAction}>
            <span>Open app</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
