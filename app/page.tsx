import Image from "next/image";

import InteractiveCardStack from "@/components/aicanvas/interactive-card-stack";
import AgentOrbSection from "@/components/landing/agent-orb-section";
import MemoryIntoExperience from "@/components/landing/memory-into-experience";
import OrbWorldReveal from "@/components/landing/orb-world-reveal";

import {
  AccessOpenButton,
  LandingActionsProvider,
  WaitlistOpenButton,
} from "./LandingActions";
import styles from "./page.module.css";

export default function Home() {
  return (
    <LandingActionsProvider>
      <main className={styles.page} data-landing-page>
        <section className={styles.hero}>
          <h1 className={styles.title}>
            Experiences that feel strangely meant for you.
          </h1>

          <div className={styles.stack}>
            <InteractiveCardStack />
          </div>

          <div className={styles.actions}>
            <WaitlistOpenButton className={styles.action}>
              <span className={styles.actionMark} aria-hidden="true">
                <Image src="/chapter-mark.svg" alt="" width={32} height={32} />
              </span>
              Join waitlist
            </WaitlistOpenButton>
            <AccessOpenButton className={styles.loginAction}>
              Access
            </AccessOpenButton>
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
        <AgentOrbSection />
      </main>
    </LandingActionsProvider>
  );
}
