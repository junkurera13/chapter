"use client";

import { useEffect, useRef } from "react";

import styles from "./agent-orb-section.module.css";

const ORB_PLAYBACK_RATE = 0.9;

export function shouldPlayAgentOrb({
  documentVisible,
  isVisible,
  playWhileMounted,
  reducedMotion,
}: {
  documentVisible: boolean;
  isVisible: boolean;
  playWhileMounted: boolean;
  reducedMotion: boolean;
}) {
  return (
    documentVisible &&
    (playWhileMounted || isVisible) &&
    (playWhileMounted || !reducedMotion)
  );
}

export default function AgentOrbVideo({
  src = "/you-agent-orb.mp4",
  poster = "/you-agent-orb-poster.jpg",
  playWhileMounted = false,
  preload = "metadata",
}: {
  src?: string;
  poster?: string;
  playWhileMounted?: boolean;
  /**
   * "auto" where the orb is small and short-lived. Metadata alone means the
   * poster holds the frame until the file arrives, and an orb that is only on
   * screen for a few seconds spends all of them looking like a still image.
   */
  preload?: "none" | "metadata" | "auto";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultPlaybackRate = ORB_PLAYBACK_RATE;
    video.playbackRate = ORB_PLAYBACK_RATE;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let isVisible = false;

    const updatePlayback = () => {
      const shouldPlay = shouldPlayAgentOrb({
        documentVisible: document.visibilityState === "visible",
        isVisible,
        playWhileMounted,
        reducedMotion: reducedMotion.matches,
      });

      if (shouldPlay) {
        void video.play().catch(() => {
          // The poster remains visible if a browser blocks autoplay.
        });
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        updatePlayback();
      },
      {
        root: video.closest("main"),
        threshold: [0, 0.35],
      },
    );

    // An orb told to play while it is mounted should not wait to be told it is
    // on screen first. It never depended on that answer.
    if (playWhileMounted) updatePlayback();

    observer.observe(video);
    reducedMotion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
      video.pause();
    };
  }, [playWhileMounted]);

  return (
    <video
      ref={videoRef}
      className={styles.orbVideo}
      muted
      loop
      playsInline
      autoPlay={playWhileMounted}
      preload={preload}
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
