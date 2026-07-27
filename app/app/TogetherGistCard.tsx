"use client";

import { useState } from "react";

import AnchoredCopy, { type CopyAnchor } from "../../components/anchored-copy";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
import type { IntroductionRecord } from "../../lib/introductionSchema";
import { nextSaturdayIso } from "../../lib/nowClient";
import type { TogetherChapterRecord } from "../../lib/togetherChapterSchema";
import type { TogetherGist } from "../../lib/togetherGistSchema";
import styles from "./TogetherView.module.css";

function todayIso() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function friendlyDate(iso?: string) {
  if (!iso) return "";
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Where a card is, in the second person, in as few words as it takes. */
function statusLine(chapter: TogetherChapterRecord) {
  const { role, status, partnerName } = chapter;
  if (status === "draft") return "Only you can see this";
  if (status === "proposed") {
    return role === "initiator"
      ? `Sent to ${partnerName}`
      : `${partnerName} sent you this`;
  }
  if (status === "accepted") {
    return chapter.youLived
      ? `Waiting on ${partnerName}`
      : friendlyDate(chapter.scheduledFor);
  }
  if (status === "lived") return `You and ${partnerName} lived this`;
  if (status === "declined") {
    return chapter.declinedByRole === role
      ? "You passed on this one"
      : `${partnerName} couldn’t make that one`;
  }
  if (status === "failed") return "That search came home empty-handed";
  return "";
}

/**
 * The person the card is about, lit inside the sentence rather than drawn
 * above it. Every gist line names them by contract with the composer, so the
 * name becomes an orb chip in the same material people wear everywhere else —
 * one object, read once, instead of a header repeating what the line says.
 *
 * Someone you have not met has no name to light, so the sentence carries only
 * the threads. The hollow orb in the status line stands in for them until the
 * second yes gives them one.
 */
function withPartner(
  partnerName: string | undefined,
  anchors: readonly CopyAnchor[],
): CopyAnchor[] {
  if (!partnerName) return [...anchors];
  return [
    ...anchors,
    { label: partnerName, category: "people", lit: true },
  ];
}

/**
 * One person, and whatever Chapter currently has to say about the two of you.
 *
 * A gist is the resting state: something Chapter noticed without being asked.
 * Before you have met, that gist names nobody and asks a question instead of
 * offering a plan. After you have, it carries their name. Once a chapter grows
 * from it, the chapter grows out of this same card — so the reason and the
 * thing it became are never two separate objects on screen, and saying yes to
 * a stranger does not swap one card for another.
 */
export default function TogetherGistCard({
  partnerName,
  gist,
  introduction,
  chapter,
  busy,
  notice,
  stageLabel,
  onGo,
  onAnswer,
  onMute,
  onSend,
  onAccept,
  onDecline,
  onLived,
}: {
  partnerName?: string;
  gist?: TogetherGist;
  introduction?: IntroductionRecord;
  chapter?: TogetherChapterRecord;
  busy: boolean;
  notice: string;
  stageLabel: string;
  onGo: () => void;
  onAnswer: (answer: "yes" | "no") => void;
  onMute: () => void;
  onSend: (proposedFor: string) => void;
  onAccept: (scheduledFor: string) => void;
  onDecline: (reason: string) => void;
  onLived: () => void;
}) {
  const [dateDraft, setDateDraft] = useState(
    chapter?.proposedFor || nextSaturdayIso(),
  );
  const [declining, setDeclining] = useState(false);
  const [declineDraft, setDeclineDraft] = useState("");

  const content = chapter?.content;
  const answerable = chapter?.status === "proposed" && chapter.role === "partner";
  const sendable = chapter?.status === "draft" && chapter.role === "initiator";
  const livable = chapter?.status === "accepted" && !chapter.youLived;
  const researching = chapter?.status === "researching";
  const unanswered = introduction?.state === "offered";
  const waiting = introduction?.state === "waiting";

  const status = chapter
    ? statusLine(chapter)
    : introduction
      ? (waiting ? "You said yes" : "Someone you haven’t met")
      : "";
  const line = gist?.line ?? introduction?.line ?? "";
  const anchors = gist?.anchors ?? introduction?.anchors ?? [];

  const wide = Boolean(content || researching);

  return (
    <article
      className={`${styles.card} ${wide ? styles.cardTall : ""}`}
      aria-busy={researching || undefined}
      aria-live={researching ? "polite" : undefined}
    >
      {status ? (
        <p className={styles.cardStatus}>
          {introduction ? (
            <span className={styles.strangerOrb} aria-hidden="true" />
          ) : null}
          {status}
        </p>
      ) : null}

      <div className={styles.cardBody}>
        {line ? (
          <p
            className={content || waiting
              ? styles.gistLineQuiet
              : styles.gistLine}
          >
            <AnchoredCopy
              text={line}
              anchors={withPartner(partnerName, anchors)}
            />
          </p>
        ) : null}

        {researching ? (
          <div className={styles.researching}>
            <ChapterLoadingMark label={stageLabel} size={64} />
          </div>
        ) : null}

        {content ? (
          <div className={styles.chapterPanel}>
            <h2 className={styles.cardTitle}>{content.title}</h2>

            <p className={styles.invitation}>
              <AnchoredCopy
                text={content.invitation}
                anchors={chapter?.brief?.anchors ?? []}
              />
            </p>

            <div className={styles.knownUnknown}>
              <p className={styles.knownLine}>
                <AnchoredCopy
                  text={content.knownLine}
                  anchors={chapter?.brief?.anchors ?? []}
                />
              </p>
              <p className={styles.unknownLine}>{content.unknownLine}</p>
            </div>

            <div className={styles.venue}>
              <p className={styles.venueName}>{content.venueName}</p>
              <p className={styles.venueMeta}>
                {content.venueArea}
                {content.address ? ` · ${content.address}` : ""}
              </p>
              <p className={styles.venueMeta}>{content.bestTime}</p>
              {content.priceNote ? (
                <p className={styles.venueMeta}>{content.priceNote}</p>
              ) : null}
              <p className={styles.whyUncommon}>{content.whyUncommon}</p>
              {chapter?.evidence && chapter.evidence.length > 0 ? (
                <p className={styles.evidence}>
                  {chapter.evidence.map((link, index) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      proof {index + 1}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.cardFoot}>
        {/*
          Before you have met, the card asks rather than plans. There is no
          "Go together" here on purpose: there is no one to go with until
          they have said yes too.
        */}
        {unanswered ? (
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => onAnswer("yes")}>
              I’d go
            </button>
            <button
              type="button"
              className={styles.quiet}
              disabled={busy}
              onClick={() => onAnswer("no")}
            >
              Not this one
            </button>
          </div>
        ) : null}

        {waiting ? (
          <p className={styles.strangerWaiting}>
            If they say yes too, you’ll both know.
          </p>
        ) : null}

        {/*
          The way out, where the thing it is about is. There is no setting for
          this elsewhere and no switch to find: someone who does not want these
          says so the first time they see one.
        */}
        {unanswered ? (
          <button
            type="button"
            className={styles.strangerMute}
            disabled={busy}
            onClick={onMute}
          >
            Stop showing me these
          </button>
        ) : null}

        {!chapter && !introduction ? (
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={onGo}>
              Go together
            </button>
          </div>
        ) : null}

        {sendable ? (
          <div className={styles.handoff}>
            <input
              type="date"
              className={styles.dateField}
              value={dateDraft}
              min={todayIso()}
              onChange={(event) => setDateDraft(event.target.value)}
              aria-label="The day this happens"
            />
            <div className={styles.actions}>
              <button
                type="button"
                disabled={busy || !dateDraft}
                onClick={() => onSend(dateDraft)}
              >
                Send to {partnerName}
              </button>
            </div>
          </div>
        ) : null}

        {answerable && !declining ? (
          <div className={styles.handoff}>
            <p className={styles.proposedFor}>
              {friendlyDate(chapter?.proposedFor)}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(chapter?.proposedFor || dateDraft)}
              >
                I’m in
              </button>
              <button
                type="button"
                className={styles.quiet}
                onClick={() => setDeclining(true)}
              >
                Can’t make it
              </button>
            </div>
          </div>
        ) : null}

        {answerable && declining ? (
          <form
            className={styles.declineForm}
            onSubmit={(event) => {
              event.preventDefault();
              onDecline(declineDraft.trim());
            }}
          >
            <input
              type="text"
              value={declineDraft}
              onChange={(event) => setDeclineDraft(event.target.value)}
              placeholder="Why not? (helps the next one)"
              aria-label="Why this one isn’t right"
              maxLength={300}
            />
            <div className={styles.actions}>
              <button type="submit" disabled={busy}>
                Send that
              </button>
              <button
                type="button"
                className={styles.quiet}
                onClick={() => setDeclining(false)}
              >
                Back
              </button>
            </div>
          </form>
        ) : null}

        {livable ? (
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={onLived}>
              We lived this
            </button>
          </div>
        ) : null}

        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </div>
    </article>
  );
}
