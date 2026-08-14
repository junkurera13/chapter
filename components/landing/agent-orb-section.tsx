import Image from "next/image";
import Link from "next/link";

import styles from "./agent-orb-section.module.css";
import AgentOrbVideo from "./agent-orb-video";

type AgentOrbSectionProps = {
  startHref: string;
};

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.3 2.8h3.3l-7.2 8.3 8.5 10.1h-6.7L11.1 15l-5.5 6.2H2.3l7.3-8.4L1.5 2.8h6.8l4.6 5.8 5.4-5.8Zm-1.2 16.6h1.8L7.3 4.5H5.4l11.7 14.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.25"
        y="3.25"
        width="17.5"
        height="17.5"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="4.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="17.45" cy="6.7" r="1.15" fill="currentColor" />
    </svg>
  );
}

export default function AgentOrbSection({
  startHref,
}: AgentOrbSectionProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="agent-orb-invitation"
    >
      <div className={styles.content}>
        <a
          href={startHref}
          className={styles.orbAction}
          aria-label="Text Chapter to get started"
        >
          <AgentOrbVideo
            src="/you-agent-orb.mp4"
            poster="/you-agent-orb-poster.jpg"
          />
        </a>
        <h2 id="agent-orb-invitation" className={styles.invitation}>
          See where your world takes you.
        </h2>
      </div>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Image src="/chapter-mark.svg" alt="" width={36} height={36} />
          </span>
          <span className={styles.brandName}>Chapter</span>
        </div>

        <div className={styles.footerActions}>
          <a href={startHref} className={styles.textAction}>
            Text Chapter
          </a>
          <Link href="/login" className={styles.loginAction}>
            Log in
          </Link>
        </div>

        <div
          className={styles.socialActions}
          aria-label="Chapter social links"
        >
          <button
            className={styles.socialAction}
            type="button"
            disabled
            aria-label="X link coming soon"
            title="X link coming soon"
          >
            <XIcon />
          </button>
          <button
            className={styles.socialAction}
            type="button"
            disabled
            aria-label="Instagram link coming soon"
            title="Instagram link coming soon"
          >
            <InstagramIcon />
          </button>
        </div>
      </footer>
    </section>
  );
}
