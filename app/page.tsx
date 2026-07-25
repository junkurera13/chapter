import Image from "next/image";
import Link from "next/link";

import InteractiveCardStack from "@/components/aicanvas/interactive-card-stack";
import AgentOrbSection from "@/components/landing/agent-orb-section";
import MemoryIntoExperience from "@/components/landing/memory-into-experience";
import OrbWorldReveal from "@/components/landing/orb-world-reveal";

import styles from "./page.module.css";

const START_HREF = "/login";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Experiences that feel strangely meant for you.
        </h1>

        <div className={styles.stack}>
          <InteractiveCardStack />
        </div>

        <div className={styles.actions}>
          <a href={START_HREF} className={styles.action}>
            <span className={styles.actionMark} aria-hidden="true">
              <Image src="/sidequest-mark.svg" alt="" width={32} height={32} />
            </span>
            Get Started
          </a>
          <Link href="/login" className={styles.loginAction}>
            Log in
          </Link>
        </div>
      </section>

      <section
        id="orbs"
        className={styles.orbSection}
        aria-labelledby="orb-world-title"
      >
        <h2 id="orb-world-title">Your memories become a world.</h2>
        <OrbWorldReveal />
      </section>

      <MemoryIntoExperience />
      <AgentOrbSection startHref={START_HREF} />
    </main>
  );
}
