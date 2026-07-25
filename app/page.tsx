import Image from "next/image";
import { Suspense } from "react";

import InteractiveCardStack from "@/components/aicanvas/interactive-card-stack";
import AgentOrbSection from "@/components/landing/agent-orb-section";
import MemoryIntoExperience from "@/components/landing/memory-into-experience";
import OrbWorldReveal from "@/components/landing/orb-world-reveal";

import {
  AuthOpenButton,
  LandingAuthProvider,
} from "./LandingAuth";
import styles from "./page.module.css";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const auth = params.auth;
  const initialAuthOpen =
    auth === "1" || (Array.isArray(auth) && auth.includes("1"));

  return (
    <Suspense fallback={<LandingFallback />}>
      <LandingAuthProvider initialOpen={initialAuthOpen}>
        <main className={styles.page} data-landing-page>
          <section className={styles.hero}>
            <h1 className={styles.title}>
              Experiences that feel strangely meant for you.
            </h1>

            <div className={styles.stack}>
              <InteractiveCardStack />
            </div>

            <div className={styles.actions}>
              <AuthOpenButton className={styles.action}>
                <span className={styles.actionMark} aria-hidden="true">
                  <Image
                    src="/sidequest-mark.svg"
                    alt=""
                    width={32}
                    height={32}
                  />
                </span>
                Get Started
              </AuthOpenButton>
              <AuthOpenButton className={styles.loginAction}>
                Log in
              </AuthOpenButton>
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
      </LandingAuthProvider>
    </Suspense>
  );
}

function LandingFallback() {
  return <main className={styles.page} aria-busy="true" />;
}
