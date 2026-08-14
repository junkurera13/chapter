"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

import mojikoImage from "@/app/assets/mojiko-memory/waterfront-sunset.webp";
import { categoryOrbGradient } from "@/app/app/categoryAppearance";

import styles from "./mojiko-connection.module.css";

export default function MojikoConnection() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const setSectionRef = useCallback((node: HTMLElement | null) => {
    sectionRef.current = node;
    scrollContainerRef.current = node?.parentElement ?? null;
  }, []);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    target: sectionRef,
    offset: ["start end", "center center"],
  });

  const headingOpacity = useTransform(scrollYProgress, [0.05, 0.3], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.05, 0.3], [24, 0]);
  const leftX = useTransform(scrollYProgress, [0.12, 0.72], [-48, 0]);
  const rightX = useTransform(scrollYProgress, [0.12, 0.72], [48, 0]);
  const imageScale = useTransform(scrollYProgress, [0.12, 0.72], [0.97, 1]);
  const copyOpacity = useTransform(scrollYProgress, [0.52, 0.84], [0, 1]);
  const copyY = useTransform(scrollYProgress, [0.52, 0.84], [20, 0]);

  return (
    <section
      className={styles.section}
      ref={setSectionRef}
      aria-labelledby="mojiko-connection-title"
    >
      <motion.h2
        id="mojiko-connection-title"
        style={
          reduceMotion
            ? undefined
            : { opacity: headingOpacity, y: headingY }
        }
      >
        A familiar place. An unfamiliar person.
      </motion.h2>

      <motion.div
        className={styles.memory}
        style={reduceMotion ? undefined : { scale: imageScale }}
      >
        <motion.div
          className={`${styles.memoryHalf} ${styles.memoryHalfLeft}`}
          style={reduceMotion ? undefined : { x: leftX }}
        >
          <Image
            className={styles.image}
            src={mojikoImage}
            alt="Mojiko waterfront with a red boat crossing the harbour"
            fill
            sizes="(max-width: 720px) 94vw, 76rem"
          />
        </motion.div>

        <motion.div
          className={`${styles.memoryHalf} ${styles.memoryHalfRight}`}
          style={reduceMotion ? undefined : { x: rightX }}
          aria-hidden="true"
        >
          <Image
            className={styles.image}
            src={mojikoImage}
            alt=""
            fill
            sizes="(max-width: 720px) 94vw, 76rem"
          />
        </motion.div>

        <div className={styles.imageVeil} aria-hidden="true" />

        <motion.div
          className={`${styles.person} ${styles.personYou}`}
          style={reduceMotion ? undefined : { opacity: copyOpacity, y: copyY }}
          aria-hidden="true"
        >
          <span
            className={styles.personOrb}
            style={{ background: categoryOrbGradient("self") }}
          />
          You
        </motion.div>

        <motion.div
          className={`${styles.person} ${styles.personSamuel}`}
          style={reduceMotion ? undefined : { opacity: copyOpacity, y: copyY }}
          aria-hidden="true"
        >
          <span
            className={styles.personOrb}
            style={{ background: categoryOrbGradient("people") }}
          />
          Samuel
        </motion.div>
      </motion.div>

      <motion.div
        className={styles.copy}
        style={reduceMotion ? undefined : { opacity: copyOpacity, y: copyY }}
      >
        <p>
          You and Samuel both know the feeling of cycling around Mojiko. The
          new experience is returning together.
        </p>
      </motion.div>
    </section>
  );
}
