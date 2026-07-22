"use client";

import { useState } from "react";
import BottomNavigation, {
  type SidequestTabIndex,
} from "./BottomNavigation";
import YouView from "./YouView";
import styles from "./page.module.css";

export default function SidequestApp() {
  // The finished product will open on Now. While the personal world is being
  // designed, open directly into You so the visual can be judged honestly.
  const [activeIndex, setActiveIndex] = useState<SidequestTabIndex>(1);

  return (
    <main className={styles.canvas} aria-label="Sidequest app">
      <section
        className={styles.panel}
        id={`sidequest-panel-${activeIndex}`}
        role="tabpanel"
        aria-labelledby={`sidequest-tab-${activeIndex}`}
      >
        {activeIndex === 1 ? <YouView /> : null}
      </section>

      <BottomNavigation
        activeIndex={activeIndex}
        onChange={setActiveIndex}
      />
    </main>
  );
}
