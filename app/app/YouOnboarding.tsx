"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import ceramicsImage from "../assets/ceramics-class.jpg";
import mojikoImage from "../assets/mojiko-memory/waterfront-sunset.webp";
import sushiImage from "../assets/sushi-shibuya.webp";
import AgentOrbVideo from "../../components/landing/agent-orb-video";
import {
  createExperienceMemory,
  describeMemorySubmissionFailure,
  type MemorySubmissionFailure,
  type UploadedMemoryPhoto,
  uploadMemoryPhoto,
  validateMemoryPhoto,
} from "../../lib/base44Memory";
import { startFirstExperience } from "../../lib/nowClient";

import styles from "./YouOnboarding.module.css";
import MemoryProcessingScreen from "./MemoryProcessingScreen";

const MAX_PHOTOS = 4;
const PHOTO_UPLOAD_CONCURRENCY = 3;

type MemoryPhoto = {
  id: number;
  name: string;
  note: string;
  url: string;
  file: File;
  uploaded?: UploadedMemoryPhoto;
};

function focusWithoutScrolling(element: HTMLTextAreaElement | null) {
  element?.focus({ preventScroll: true });
}

function resizeMemoryInput(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export default function YouOnboarding({
  onMemoryCreated,
  composerOnly = false,
  onSubmitStarted,
  createFirstExperience = false,
}: {
  onMemoryCreated: () => void;
  /**
   * Opened from a world that already exists, so there is no question to ask
   * first: the composer is the whole of it, and there is no way back to the
   * invitation because the invitation was the button that opened this.
   */
  composerOnly?: boolean;
  /**
   * Hands the send up the moment it leaves, instead of holding the screen
   * until Chapter has finished reading it. Whoever takes it owns what happens
   * next; this component is finished the instant it is called.
   */
  onSubmitStarted?: (work: Promise<unknown>) => void;
  /**
   * The first send also asks Chapter to make the person's first experience.
   * Later memories only advance the world.
   */
  createFirstExperience?: boolean;
}) {
  const [started, setStarted] = useState(composerOnly);
  const [memoryText, setMemoryText] = useState("");
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [submissionFailure, setSubmissionFailure] =
    useState<MemorySubmissionFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const memoryInputRef = useRef<HTMLTextAreaElement>(null);
  const nextPhotoId = useRef(0);
  const requestId = useRef<string | null>(null);
  const objectUrls = useRef(new Set<string>());
  const reduceMotion = useReducedMotion();

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [],
  );

  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        bounce: 0,
        duration: 0.68,
      };

  function openPhotoPicker() {
    if (submitting) return;
    setNotice("");
    setSubmissionFailure(null);
    inputRef.current?.click();
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const validFiles: File[] = [];
    let validationMessage = "";
    for (const file of selectedFiles) {
      try {
        validateMemoryPhoto(file);
        validFiles.push(file);
      } catch (error) {
        validationMessage =
          error instanceof Error ? error.message : "That image could not be added.";
      }
    }

    const remaining = MAX_PHOTOS - photos.length;
    const acceptedFiles = validFiles.slice(0, remaining);
    const nextPhotos = acceptedFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);

      return {
        id: nextPhotoId.current++,
        name: file.name,
        note: "",
        url,
        file,
      };
    });

    setPhotos((current) => [...current, ...nextPhotos]);

    if (validFiles.length > remaining) {
      setNotice(`You can add up to ${MAX_PHOTOS} photos.`);
    } else if (validationMessage) {
      setNotice(validationMessage);
    } else {
      setNotice("");
    }
  }

  function removePhoto(photoId: number) {
    const removed = photos.find((photo) => photo.id === photoId);
    if (removed) {
      URL.revokeObjectURL(removed.url);
      objectUrls.current.delete(removed.url);
    }

    const nextPhotos = photos.filter((photo) => photo.id !== photoId);
    setPhotos(nextPhotos);
    if (editingPhotoId === photoId) setEditingPhotoId(null);
    setNotice("");
  }

  function updateNote(photoId: number, note: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, note } : photo,
      ),
    );
  }

  function handleSurfaceClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (
      composerOnly ||
      submitting ||
      !started ||
      photos.length > 0 ||
      memoryText.trim().length > 0
    ) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(`.${styles.memoryComposer}`)
    ) {
      return;
    }

    setStarted(false);
  }

  function clearFailedComposer() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setMemoryText("");
    setPhotos([]);
    setEditingPhotoId(null);
    requestId.current = null;
    if (memoryInputRef.current) {
      memoryInputRef.current.style.height = "auto";
    }
  }

  function startAgain() {
    setSubmissionFailure(null);
    requestAnimationFrame(() => focusWithoutScrolling(memoryInputRef.current));
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || (!memoryText.trim() && photos.length === 0)) return;

    setSubmitting(true);
    setEditingPhotoId(null);
    setNotice("");
    setSubmissionFailure(null);

    /**
     * Everything the send has to do, as one piece of work that does not need
     * this screen to stay open for it. The photo state it writes back into is
     * only there to save a re-upload on retry, so it is free to land on a
     * component that has already gone.
     */
    const send = async () => {
      const uploadedPhotos: UploadedMemoryPhoto[] = [];
      for (
        let start = 0;
        start < photos.length;
        start += PHOTO_UPLOAD_CONCURRENCY
      ) {
        const batch = photos.slice(start, start + PHOTO_UPLOAD_CONCURRENCY);
        const uploadedBatch = await Promise.all(
          batch.map(async (photo) => {
            const uploaded = photo.uploaded
              ? { ...photo.uploaded, context: photo.note.trim() }
              : await uploadMemoryPhoto(photo.file, photo.note);
            if (!photo.uploaded) {
              setPhotos((current) =>
                current.map((candidate) =>
                  candidate.id === photo.id
                    ? { ...candidate, uploaded }
                    : candidate,
                ),
              );
            }
            return uploaded;
          }),
        );
        uploadedPhotos.push(...uploadedBatch);
      }

      requestId.current ??= crypto.randomUUID();
      await createExperienceMemory({
        clientRequestId: requestId.current,
        text: memoryText,
        images: uploadedPhotos,
        source: "onboarding",
      });

      if (createFirstExperience) {
        // The world exists the moment the graph lands, and that is what the
        // person is waiting to see. Writing the first experience takes its own
        // model call, so it starts here and finishes on its own; Now watches
        // for it and shows it when it arrives. Nobody waits twice.
        //
        // The memory is already safely part of the person's world. A missing
        // location or an unavailable research provider must not turn that
        // successful send into a destructive retry.
        void startFirstExperience().catch((error) => {
          console.error("Could not start the first experience", error);
        });
      }
    };

    // Sent from a world that already exists: the send goes on without this
    // screen, and the screen goes away. Nobody waits at a spinner for a thing
    // that has already left.
    if (onSubmitStarted) {
      onSubmitStarted(send());
      return;
    }

    try {
      await send();
      onMemoryCreated();
    } catch (error) {
      console.error("Could not create the memory map", error);
      const failure = describeMemorySubmissionFailure(error);
      clearFailedComposer();
      setSubmissionFailure(failure);
      setSubmitting(false);
    }
  }

  const addButton = (
    <button
      className={styles.addButton}
      type="button"
      aria-label={photos.length === 0 ? "Add photos" : "Add more photos"}
      disabled={submitting || photos.length >= MAX_PHOTOS}
      onClick={openPhotoPicker}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>{photos.length === 0 ? "Add photos" : "Add more"}</span>
    </button>
  );

  const canSend = memoryText.trim().length > 0 || photos.length > 0;

  return (
    <LayoutGroup>
      <div
        className={styles.onboarding}
        data-started={started}
        data-inline={composerOnly ? "true" : "false"}
        onClick={handleSurfaceClick}
      >
        {started && !composerOnly ? (
          <>
            <button
              className={`${styles.edgeBack} ${styles.edgeBackLeft}`}
              type="button"
              tabIndex={-1}
              aria-label="Return to the memory question"
              disabled={submitting}
              onClick={() => setStarted(false)}
            />
            <button
              className={`${styles.edgeBack} ${styles.edgeBackRight}`}
              type="button"
              tabIndex={-1}
              aria-label="Return to the memory question"
              disabled={submitting}
              onClick={() => setStarted(false)}
            />
          </>
        ) : null}

        <div className={styles.stage}>
          <div className={styles.prompt}>
            <motion.button
              className={styles.orb}
              type="button"
              aria-hidden={composerOnly || undefined}
              tabIndex={composerOnly ? -1 : undefined}
              aria-label={
                started
                  ? "Return to the memory question"
                  : "Begin adding a memory"
              }
              layout
              layoutDependency={started}
              transition={layoutTransition}
              disabled={submitting || composerOnly}
              onClick={() => setStarted((current) => !current)}
            >
              {/*
                In the window it plays unconditionally. The orb decides for
                itself whether it is on screen by watching its nearest <main>,
                and inside a fixed overlay above a clipped canvas that check
                answers "no" forever — so the orb would sit on its poster.
              */}
              <AgentOrbVideo
                src="/you-agent-orb.mp4"
                poster="/you-agent-orb-poster.jpg"
                playWhileMounted={composerOnly}
              />
            </motion.button>

            <motion.div
              className={styles.promptCopy}
              aria-live="polite"
              layout="position"
              layoutDependency={started}
              transition={layoutTransition}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={started ? "composer" : "invitation"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.12 : 0.34,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {!started
                    ? "What’s a moment that still feels like yesterday?"
                    : "Tell me everything you remember."}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {started ? (
              <motion.div
                className={styles.workspace}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 16 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: reduceMotion ? 0.14 : 0.44,
                    delay: reduceMotion ? 0 : 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0.12 } }
                    : {
                        opacity: 0,
                        y: 8,
                        transition: {
                          duration: 0.22,
                          ease: [0.4, 0, 1, 1],
                        },
                      }
                }
              >
                <div className={styles.composerShell}>
                  <form
                    className={styles.memoryComposer}
                    onSubmit={handleComposerSubmit}
                    aria-busy={submitting}
                    aria-describedby={
                      submissionFailure
                        ? "memory-submission-error"
                        : notice
                          ? "memory-composer-notice"
                          : undefined
                    }
                  >
                    <div className={styles.composerSplit}>
                      <div className={styles.textColumn}>
                        <div className={styles.textWindow}>
                          <textarea
                            ref={memoryInputRef}
                            className={styles.memoryInput}
                            value={memoryText}
                            maxLength={6000}
                            disabled={submitting}
                            aria-label="Tell Chapter about this memory"
                            placeholder="Start anywhere. The place, the people, what happened, how it felt… You can also add up to four photos, with a little context for each."
                            onChange={(event) => {
                              setSubmissionFailure(null);
                              setMemoryText(event.target.value);
                              resizeMemoryInput(event.currentTarget);
                            }}
                          />

                          <AnimatePresence initial={false}>
                            {canSend ? (
                              <motion.button
                                className={styles.sendButton}
                                type="submit"
                                aria-label={
                                  submitting
                                    ? "Chapter is understanding this memory"
                                    : "Send memory to Chapter"
                                }
                                disabled={submitting}
                                initial={
                                  reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: 4, scale: 0.92 }
                                }
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                whileHover={
                                  reduceMotion ? undefined : { y: -1 }
                                }
                                whileTap={
                                  reduceMotion
                                    ? undefined
                                    : { y: 2, scale: 0.985 }
                                }
                                exit={
                                  reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: 4, scale: 0.96 }
                                }
                                transition={{
                                  duration: reduceMotion ? 0.12 : 0.22,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <path d="M12 19V5M6 11l6-6 6 6" />
                                </svg>
                              </motion.button>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>

                      <AnimatePresence mode="popLayout" initial={false}>
                      {photos.length > 0 ? (
                        <motion.section
                          className={styles.composerPhotos}
                          key="uploaded-photos"
                          aria-label="Photos from this memory"
                          layout
                          initial={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 12 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 8 }
                          }
                          transition={{
                            duration: reduceMotion ? 0.12 : 0.24,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <motion.div className={styles.photoGrid} layout>
                            <AnimatePresence initial={false}>
                              {photos.map((photo, index) => {
                                const isEditing = editingPhotoId === photo.id;

                                return (
                                <motion.article
                                  className={styles.photoCard}
                                  key={photo.id}
                                  aria-label={`Photo ${index + 1}`}
                                  data-editing={isEditing}
                                  layout
                                  initial={
                                    reduceMotion
                                      ? { opacity: 0 }
                                      : {
                                          opacity: 0,
                                          y: 18,
                                          scale: 0.97,
                                        }
                                  }
                                  animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                  }}
                                  exit={
                                    reduceMotion
                                      ? { opacity: 0 }
                                      : {
                                          opacity: 0,
                                          y: 8,
                                          scale: 0.98,
                                        }
                                  }
                                  whileHover={
                                    reduceMotion || isEditing
                                      ? undefined
                                      : { y: -4, scale: 1.01 }
                                  }
                                  transition={{
                                    layout: layoutTransition,
                                    opacity: {
                                      duration: reduceMotion ? 0.12 : 0.22,
                                      delay: reduceMotion
                                        ? 0
                                        : Math.min(index * 0.04, 0.2),
                                    },
                                    y: {
                                      type: "spring",
                                      bounce: 0,
                                      duration: reduceMotion ? 0 : 0.3,
                                    },
                                    scale: {
                                      type: "spring",
                                      bounce: 0,
                                      duration: reduceMotion ? 0 : 0.3,
                                    },
                                  }}
                                >
                                  <div className={styles.photo}>
                                    {/* Blob URLs are local previews and cannot use the Next image optimizer. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photo.url} alt="" />

                                    <button
                                      className={`${styles.cardAction} ${styles.removeButton}`}
                                      type="button"
                                      aria-label={`Remove ${photo.name}`}
                                      disabled={submitting}
                                      onClick={() => removePhoto(photo.id)}
                                    >
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                      >
                                        <path d="m7 7 10 10M17 7 7 17" />
                                      </svg>
                                    </button>

                                    <button
                                      className={`${styles.cardAction} ${styles.editButton}`}
                                      type="button"
                                      disabled={submitting}
                                      aria-label={
                                        photo.note
                                          ? `Edit context for ${photo.name}`
                                          : `Add context to ${photo.name}`
                                      }
                                      onClick={() =>
                                        setEditingPhotoId(photo.id)
                                      }
                                    >
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                      >
                                        <path d="m4 20 4.25-1L19 8.25a2.12 2.12 0 0 0-3-3L5.25 16 4 20Z" />
                                        <path d="m14.75 6.5 2.75 2.75" />
                                      </svg>
                                    </button>

                                    <AnimatePresence initial={false}>
                                      {isEditing ? (
                                        <motion.div
                                          className={styles.noteEditor}
                                          key="editor"
                                          initial={
                                            reduceMotion
                                              ? { opacity: 0 }
                                              : {
                                                  opacity: 0,
                                                  y: 8,
                                                  scale: 0.97,
                                                }
                                          }
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: 1,
                                          }}
                                          exit={
                                            reduceMotion
                                              ? { opacity: 0 }
                                              : {
                                                  opacity: 0,
                                                  y: 8,
                                                  scale: 0.97,
                                                }
                                          }
                                          transition={{
                                            type: "spring",
                                            bounce: 0,
                                            duration: reduceMotion ? 0 : 0.28,
                                          }}
                                        >
                                          <textarea
                                            className={styles.note}
                                            value={photo.note}
                                            maxLength={280}
                                            disabled={submitting}
                                            ref={focusWithoutScrolling}
                                            aria-label={`Context for ${photo.name}`}
                                            placeholder="What should I know about this photo?"
                                            onChange={(event) =>
                                              updateNote(
                                                photo.id,
                                                event.target.value,
                                              )
                                            }
                                            onKeyDown={(event) => {
                                              if (event.key === "Escape") {
                                                setEditingPhotoId(null);
                                              }
                                            }}
                                          />
                                          <button
                                            className={styles.doneButton}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() =>
                                              setEditingPhotoId(null)
                                            }
                                          >
                                            {photo.note.trim()
                                              ? "Done"
                                              : "Cancel"}
                                          </button>
                                        </motion.div>
                                      ) : photo.note ? (
                                        <motion.p
                                          className={styles.notePreview}
                                          key="preview"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                        >
                                          <span>{photo.note}</span>
                                        </motion.p>
                                      ) : null}
                                    </AnimatePresence>
                                  </div>
                                </motion.article>
                              );
                            })}
                          </AnimatePresence>
                        </motion.div>

                        <div className={styles.photoActions}>
                          {addButton}
                        </div>
                      </motion.section>
                      ) : (
                        <motion.section
                          className={`${styles.composerPhotos} ${styles.photoStarter}`}
                          key="photo-starter"
                          aria-label="Add photos from this memory"
                          layout
                          initial={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 10 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 6 }
                          }
                          transition={{
                            duration: reduceMotion ? 0.12 : 0.24,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <div
                            className={`${styles.sampleCard} ${styles.sampleCardLeft}`}
                          >
                            <Image
                              src={mojikoImage}
                              alt=""
                              fill
                              sizes="18rem"
                              placeholder="blur"
                            />
                          </div>
                          <div
                            className={`${styles.sampleCard} ${styles.sampleCardRight}`}
                          >
                            <Image
                              src={ceramicsImage}
                              alt=""
                              fill
                              sizes="18rem"
                              placeholder="blur"
                            />
                          </div>
                          <div
                            className={`${styles.sampleCard} ${styles.sampleCardFront}`}
                          >
                            <Image
                              src={sushiImage}
                              alt=""
                              fill
                              sizes="9rem"
                              placeholder="blur"
                            />
                          </div>

                          <div className={styles.starterActions}>
                            {addButton}
                          </div>
                        </motion.section>
                      )}
                      </AnimatePresence>
                    </div>

                    <input
                      ref={inputRef}
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={submitting}
                      onClick={(event) => event.stopPropagation()}
                      onChange={addPhotos}
                    />

                  </form>

                  <AnimatePresence initial={false}>
                    {submitting ? (
                      <MemoryProcessingScreen
                        firstExperience={createFirstExperience}
                      />
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence mode="popLayout" initial={false}>
                    {submissionFailure ? (
                      <motion.div
                        className={styles.feedback}
                        id="memory-submission-error"
                        role="alert"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                      >
                        <p>{submissionFailure.message}</p>
                        {submissionFailure.requiresAuthentication ? (
                          <a
                            className={styles.retryButton}
                            href="/login"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Sign in again
                          </a>
                        ) : (
                          <button
                            className={styles.retryButton}
                            type="button"
                            onClick={startAgain}
                          >
                            Start again
                          </button>
                        )}
                      </motion.div>
                    ) : notice ? (
                      <motion.p
                        className={styles.notice}
                        id="memory-composer-notice"
                        role="status"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {notice}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
