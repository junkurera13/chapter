"use client";

import { useEffect, useRef } from "react";

import styles from "./agent-orb-section.module.css";

const ORB_PLAYBACK_RATE = 0.9;

export default function AgentOrbVideo({
  src = "/agent-orb.mp4",
  poster = "/agent-orb-poster.jpg",
}: {
  src?: string;
  poster?: string;
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
      const shouldPlay =
        isVisible &&
        !reducedMotion.matches &&
        document.visibilityState === "visible";

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

    observer.observe(video);
    reducedMotion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
      video.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={styles.orbVideo}
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
