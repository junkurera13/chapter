"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  signOutOfSidequest,
  type AuthenticatedViewer,
} from "../../lib/base44Auth";
import styles from "./BottomNavigation.module.css";

export const SIDEQUEST_TABS = ["You", "Now", "Together"] as const;
export type SidequestTabIndex = 0 | 1 | 2;

type BottomNavigationProps = {
  activeIndex: SidequestTabIndex;
  onChange: (index: SidequestTabIndex) => void;
  worldLocked: boolean;
  viewer: AuthenticatedViewer;
  onConnectPhone: () => void;
};

export default function BottomNavigation({
  activeIndex,
  onChange,
  worldLocked,
  viewer,
  onConnectPhone,
}: BottomNavigationProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const accountRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const initial = (viewer.name?.trim() || viewer.email).charAt(0).toUpperCase();

  useEffect(() => {
    if (!accountOpen) return;

    function closeAccount(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    window.addEventListener("pointerdown", closeAccount);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeAccount);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  function selectTab(index: SidequestTabIndex, moveFocus = false) {
    if (worldLocked && index !== 0) return;
    onChange(index);

    if (moveFocus) {
      tabRefs.current[index]?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (worldLocked) return;

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
          aria-label="Chapter views"
          data-active={activeIndex}
        >
          <span className={styles.candy} aria-hidden="true" />

          {SIDEQUEST_TABS.map((tab, index) => {
            const disabled = worldLocked && index !== 0;

            return (
              <button
                className={styles.tab}
                type="button"
                role="tab"
                id={`sidequest-tab-${index}`}
                aria-controls={`sidequest-panel-${index}`}
                aria-selected={activeIndex === index}
                aria-label={
                  disabled ? `${tab}, unlocks after your first memory` : tab
                }
                tabIndex={activeIndex === index ? 0 : -1}
                disabled={disabled}
                title={disabled ? "Share a memory in You to unlock" : undefined}
                key={tab}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                onClick={() => selectTab(index as SidequestTabIndex)}
                onKeyDown={handleKeyDown}
              >
                <span>{tab}</span>
              </button>
            );
          })}
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

      <div className={styles.account} ref={accountRef}>
        {accountOpen ? (
          <div className={styles.accountMenu} id="sidequest-account-menu">
            <p className={styles.accountName}>{viewer.name || "Your account"}</p>
            <p className={styles.accountEmail}>{viewer.email}</p>
            {viewer.messagingConnected ? (
              <p className={styles.messagingStatus}>iMessage connected</p>
            ) : (
              <button
                type="button"
                className={styles.connectPhone}
                onClick={() => {
                  setAccountOpen(false);
                  onConnectPhone();
                }}
              >
                Connect iMessage
              </button>
            )}
            <button
              type="button"
              className={styles.signOut}
              onClick={signOutOfSidequest}
            >
              Sign out
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={styles.profile}
          aria-label="Your account"
          aria-expanded={accountOpen}
          aria-controls="sidequest-account-menu"
          onClick={() => setAccountOpen((open) => !open)}
        >
          {initial}
        </button>
      </div>
    </div>
  );
}
