"use client";

import { useState } from "react";
import BottomNavigation, {
  type ChapterTabIndex,
} from "./BottomNavigation";
import YouView from "./YouView";
import TogetherView from "./TogetherView";
import styles from "./page.module.css";

export default function ChapterApp({
  initialTab = 1,
}: {
  initialTab?: ChapterTabIndex;
}) {
  // The finished product will open on Now. While the personal world is being
  // designed, open directly into You so the visual can be judged honestly.
  const [activeIndex, setActiveIndex] = useState<ChapterTabIndex>(initialTab);

  return (
    <main className={styles.canvas} aria-label="Chapter app">
      <section
        className={styles.panel}
        id={`chapter-panel-${activeIndex}`}
        role="tabpanel"
        aria-labelledby={`chapter-tab-${activeIndex}`}
      >
        {activeIndex === 1 ? <YouView /> : null}
        {activeIndex === 2 ? <TogetherView /> : null}
      </section>

      <BottomNavigation
        activeIndex={activeIndex}
        onChange={setActiveIndex}
      />
    </main>
  );
}
