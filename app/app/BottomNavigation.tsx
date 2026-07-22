"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./BottomNavigation.module.css";

export const SIDEQUEST_TABS = ["Now", "You", "Together"] as const;
export type SidequestTabIndex = 0 | 1 | 2;

type BottomNavigationProps = {
  activeIndex: SidequestTabIndex;
  onChange: (index: SidequestTabIndex) => void;
};

export default function BottomNavigation({
  activeIndex,
  onChange,
}: BottomNavigationProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: SidequestTabIndex, moveFocus = false) {
    onChange(index);

    if (moveFocus) {
      tabRefs.current[index]?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") {
      nextIndex = (activeIndex + 1) % SIDEQUEST_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (activeIndex - 1 + SIDEQUEST_TABS.length) % SIDEQUEST_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SIDEQUEST_TABS.length - 1;
    }

    if (nextIndex === undefined) return;

    event.preventDefault();
    selectTab(nextIndex as SidequestTabIndex, true);
  }

  return (
    <div className={styles.chrome}>
      <nav className={styles.dock} aria-label="Primary">
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Sidequest views"
          data-active={activeIndex}
        >
          <span className={styles.candy} aria-hidden="true" />

          {SIDEQUEST_TABS.map((tab, index) => (
            <button
              className={styles.tab}
              type="button"
              role="tab"
              id={`sidequest-tab-${index}`}
              aria-controls={`sidequest-panel-${index}`}
              aria-selected={activeIndex === index}
              tabIndex={activeIndex === index ? 0 : -1}
              key={tab}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => selectTab(index as SidequestTabIndex)}
              onKeyDown={handleKeyDown}
            >
              <span>{tab}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.logo}
        src="/sidequest-mark.svg"
        alt=""
        width={108}
        height={108}
        aria-hidden="true"
      />

      <button
        type="button"
        className={styles.profile}
        aria-label="Profile"
      >
        U
      </button>
    </div>
  );
}
