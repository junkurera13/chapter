"use client";

import { formatNodeLabel } from "../../lib/displayText";
import { useConnectionInvite } from "../../lib/useConnectionInvite";
import { categoryOrbGradient } from "./categoryAppearance";
import styles from "./TogetherView.module.css";

/**
 * A person in your world is in one of three states, and their picture says
 * which before any word does: full if they're here, dimmed behind a ring while
 * a link is out, faded if they're still only a memory. Only the last has
 * anything to press.
 */
export type PersonPresence = "connected" | "invited" | "remembered";

export type TogetherPerson = {
  nodeId: string;
  name: string;
  presence: PersonPresence;
};

/**
 * Until people bring their own picture, everyone gets the same drawn one: a
 * plain head and shoulders in grey. It is a placeholder and says so — colour
 * here would look like it meant something about the person, and it doesn't.
 *
 * Deliberately a drawing and not an orb. An orb means a thing in your world —
 * a place, an interest, a feeling — and a person is not one of those.
 */
function DefaultAvatar() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="20" fill="#e6e4e1" />
      <circle cx="20" cy="16" r="6.4" fill="#b3afaa" />
      <path
        d="M20 24.4c-6.3 0-11.4 4.3-12.4 10.1A20 20 0 0 0 20 40a20 20 0 0 0 12.4-5.5c-1-5.8-6.1-10.1-12.4-10.1Z"
        fill="#b3afaa"
      />
    </svg>
  );
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

  return (
    <aside className={styles.friends} aria-label="People in your world">
      <p className={styles.friendsHeader}>
        <span
          className={styles.friendsOrb}
          style={{ background: categoryOrbGradient("people") }}
          aria-hidden="true"
        />
        <span className={styles.friendsTitle}>Your People</span>
      </p>

      <ul className={styles.friendsList}>
        {people.map((person) => {
          const invite =
            inviteState?.nodeId === person.nodeId ? inviteState : null;
          const label = formatNodeLabel(person.name);
          return (
            <li className={styles.friend} key={person.nodeId}>
              <span
                className={`${styles.friendFace} ${
                  person.presence === "remembered"
                    ? styles.friendFaceMemory
                    : person.presence === "invited"
                      ? styles.friendFaceWaiting
                      : ""
                }`}
                aria-hidden="true"
              >
                <DefaultAvatar />
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
