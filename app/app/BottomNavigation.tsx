"use client";

import { UserButton } from "@clerk/nextjs";
import { useRef, type KeyboardEvent } from "react";
import { ChapterMark } from "@/components/ChapterMark";
import styles from "./BottomNavigation.module.css";

export const CHAPTER_TABS = ["Now", "You", "Together"] as const;
export type ChapterTabIndex = 0 | 1 | 2;

type BottomNavigationProps = {
  activeIndex: ChapterTabIndex;
  onChange: (index: ChapterTabIndex) => void;
};

export default function BottomNavigation({
  activeIndex,
  onChange,
}: BottomNavigationProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: ChapterTabIndex, moveFocus = false) {
    onChange(index);

    if (moveFocus) {
      tabRefs.current[index]?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") {
      nextIndex = (activeIndex + 1) % CHAPTER_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (activeIndex - 1 + CHAPTER_TABS.length) % CHAPTER_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = CHAPTER_TABS.length - 1;
    }

    if (nextIndex === undefined) return;

    event.preventDefault();
    selectTab(nextIndex as ChapterTabIndex, true);
  }

  return (
    <div className={styles.chrome}>
      <nav className={styles.dock} aria-label="Primary">
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Chapter views"
          data-active={activeIndex}
        >
          <span className={styles.candy} aria-hidden="true" />

          {CHAPTER_TABS.map((tab, index) => (
            <button
              className={styles.tab}
              type="button"
              role="tab"
              id={`chapter-tab-${index}`}
              aria-controls={`chapter-panel-${index}`}
              aria-selected={activeIndex === index}
              tabIndex={activeIndex === index ? 0 : -1}
              key={tab}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => selectTab(index as ChapterTabIndex)}
              onKeyDown={handleKeyDown}
            >
              <span>{tab}</span>
            </button>
          ))}
        </div>
      </nav>

      <ChapterMark className={styles.logo} />

      <div className={styles.profile}>
        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: styles.profileTrigger,
              avatarBox: styles.profileAvatar,
            },
          }}
        />
      </div>
    </div>
  );
}
