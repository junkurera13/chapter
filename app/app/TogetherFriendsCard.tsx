"use client";

import { formatNodeLabel } from "../../lib/displayText";
import { useConnectionInvite } from "../../lib/useConnectionInvite";
import { categoryOrbGradient } from "./categoryAppearance";
import styles from "./TogetherView.module.css";

/**
 * A person in your world is in one of three states, and the orb says which
 * before any word does: lit if they're here, dimmed behind a ring while a link
 * is out, hollow if they're still only a memory. Only the last has anything to
 * press.
 */
export type PersonPresence = "connected" | "invited" | "remembered";

export type TogetherPerson = {
  nodeId: string;
  name: string;
  presence: PersonPresence;
};

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "·";
}

/**
 * Your people, kept to the side in the same card Now keeps its city in: white,
 * elevated, an orb and a title across the top. It is the standing furniture of
 * the tab, so it never competes with the gists for the middle of the page.
 */
export default function TogetherFriendsCard({
  people,
  onInviteCreated,
}: {
  people: readonly TogetherPerson[];
  onInviteCreated?: () => void;
}) {
  const { inviteState, prepareInvite, shareInvite } = useConnectionInvite({
    connectedNodeIds: people
      .filter((person) => person.presence === "connected")
      .map((person) => person.nodeId),
    onInviteCreated,
  });

  if (people.length === 0) return null;

  const here = people.filter(
    (person) => person.presence === "connected",
  ).length;

  return (
    <aside className={styles.friends} aria-label="People in your world">
      <p className={styles.friendsHeader}>
        <span
          className={styles.friendsOrb}
          style={{ background: categoryOrbGradient("people") }}
          aria-hidden="true"
        />
        <span className={styles.friendsTitle}>Your people</span>
        <span className={styles.friendsCount}>
          {here}/{people.length}
        </span>
      </p>

      <ul className={styles.friendsList}>
        {people.map((person) => {
          const invite =
            inviteState?.nodeId === person.nodeId ? inviteState : null;
          const label = formatNodeLabel(person.name);
          return (
            <li className={styles.friend} key={person.nodeId}>
              <span
                className={`${styles.friendOrb} ${
                  person.presence === "remembered"
                    ? styles.friendOrbHollow
                    : person.presence === "invited"
                      ? styles.friendOrbWaiting
                      : ""
                }`}
                style={
                  person.presence === "remembered"
                    ? undefined
                    : { background: categoryOrbGradient("people") }
                }
                aria-hidden="true"
              >
                {person.presence === "remembered" ? "" : initialFor(label)}
              </span>

              <span className={styles.friendName} title={label}>
                {label}
              </span>

              {person.presence === "invited" ? (
                <span className={styles.friendTag}>Invited</span>
              ) : null}

              {person.presence === "remembered" ? (
                <button
                  type="button"
                  className={styles.inviteButton}
                  disabled={invite?.status === "creating"}
                  aria-label={
                    invite?.url ? `Send ${label} the link` : `Ask ${label} in`
                  }
                  onClick={() => {
                    if (invite?.url && invite.status !== "error") {
                      shareInvite(person.nodeId, invite.url);
                    } else {
                      void prepareInvite(person.nodeId);
                    }
                  }}
                >
                  {invite?.status === "creating"
                    ? "…"
                    : invite?.status === "shared"
                      ? "Again"
                      : invite?.status === "ready"
                        ? "Send"
                        : invite?.status === "error"
                          ? "Retry"
                          : "Ask in"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
