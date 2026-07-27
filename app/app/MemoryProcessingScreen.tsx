"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState } from "react";

import AgentOrbVideo from "../../components/landing/agent-orb-video";

import styles from "./MemoryProcessingScreen.module.css";

const PROCESSING_PHRASES = [
  "Reading",
  "Noticing details",
  "Making connections",
  "Organizing",
] as const;
const PROCESSING_PHRASE_INTERVAL_MS = 2600;

export default function MemoryProcessingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const phraseTimer = window.setInterval(() => {
      setPhraseIndex(
        (current) => (current + 1) % PROCESSING_PHRASES.length,
      );
    }, PROCESSING_PHRASE_INTERVAL_MS);

    return () => window.clearInterval(phraseTimer);
  }, [reduceMotion]);

  return (
    <motion.div
      className={styles.screen}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reduceMotion ? 0.12 : 0.24,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span className={styles.visuallyHidden}>
        Chapter is processing this memory.
      </span>
      <motion.div
        className={styles.content}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }
        }
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0.12 : 0.5,
          delay: reduceMotion ? 0 : 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className={styles.orb}>
          <AgentOrbVideo
            src="/you-agent-orb.mp4"
            poster="/you-agent-orb-poster.jpg"
            playWhileMounted
          />
        </div>
        <div className={styles.phrase} aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={phraseIndex}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: 4,
                      filter: "blur(3px)",
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: -4,
                      filter: "blur(3px)",
                    }
              }
              transition={{
                duration: reduceMotion ? 0.1 : 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {PROCESSING_PHRASES[phraseIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
