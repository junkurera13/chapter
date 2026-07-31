"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadWeeklyPack } from "@/lib/weeklyPackClient";

import { categoryOrbGradient } from "./categoryAppearance";
import HomeCityForm from "./HomeCityForm";
import styles from "./NowLocationNode.module.css";

export default function NowLocationNode() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;

    void loadWeeklyPack()
      .then((weekly) => {
        if (!active) return;
        setHomeCity(weekly.homeCity);
      })
      .catch(() => {
        if (active) setHomeCity("");
      });

    return () => {
      active = false;
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [close, open]);

  const nodeLabel =
    homeCity === null ? "Location" : homeCity || "Set your location";

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.node}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={styles.orb}
          style={{ background: categoryOrbGradient("place") }}
          aria-hidden="true"
        />
        <span className={styles.nodeLabel}>{nodeLabel}</span>
      </button>

      {open ? (
        <div
          className={styles.picker}
          role="dialog"
          aria-label="Choose your location"
        >
          <div className={styles.pickerHeading}>
            <h2>Where are you based?</h2>
            <button
              type="button"
              className={styles.close}
              aria-label="Close location picker"
              onClick={close}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m4 4 8 8m0-8-8 8" />
              </svg>
            </button>
          </div>

          <HomeCityForm
            initialValue={homeCity ?? ""}
            autoFocus
            onSaved={(saved) => {
              setHomeCity(saved);
              setAnnouncement(`Location saved as ${saved}.`);
              setOpen(false);
            }}
          />
        </div>
      ) : null}

      <p className={styles.announcement} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
