import Image from "next/image";
import Link from "next/link";

import heroImage from "@/app/assets/sidequest-coast.jpg";

import { GoogleLoginButton } from "./GoogleLoginButton";
import styles from "./page.module.css";

export default function LoginPage() {
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
        <Link href="/" aria-label="Sidequest home">
          <Image
            className={styles.brandMark}
            src="/sidequest-mark.svg"
            alt=""
            width={108}
            height={108}
          />
        </Link>
      </header>

      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          Experiences that feel strangely meant for you.
        </h1>
        <div className={styles.action}>
          <GoogleLoginButton />
        </div>
      </section>
    </main>
  );
}
