"use client";

import { useCallback, useState } from "react";

import pageStyles from "@/app/page.module.css";

import OrbRow from "./orb-row";

export default function OrbWorldReveal() {
  const [isComplete, setIsComplete] = useState(false);
  const handleRevealComplete = useCallback(() => setIsComplete(true), []);

  return (
    <>
      <div className={pageStyles.orbRow}>
        <OrbRow onRevealComplete={handleRevealComplete} />
      </div>
      <p
        className={`${pageStyles.orbPrinciple} t-stagger ${isComplete ? "is-shown" : ""}`}
      >
        <span className="t-stagger-line">
          Every memory is distilled into what made it meaningful and added to a
          world Sidequest understands, so it can create experiences that feel
          like you, without feeling like anything you’ve done before.
        </span>
      </p>
    </>
  );
}
