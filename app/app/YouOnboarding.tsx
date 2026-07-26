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
import mojikoImage from "../assets/mojiko-waterfront.jpg";
import sushiImage from "../assets/sushi-shibuya.webp";
import AgentOrbVideo from "../../components/landing/agent-orb-video";

import styles from "./YouOnboarding.module.css";

const MAX_PHOTOS = 8;

type MemoryPhoto = {
  id: number;
  name: string;
  note: string;
  url: string;
};

function focusWithoutScrolling(element: HTMLTextAreaElement | null) {
  element?.focus({ preventScroll: true });
}

export default function YouOnboarding() {
  const [started, setStarted] = useState(false);
  const [memoryText, setMemoryText] = useState("");
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const nextPhotoId = useRef(0);
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
    setNotice("");
    inputRef.current?.click();
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    const acceptedFiles = selectedFiles.slice(0, remaining);
    const nextPhotos = acceptedFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);

      return {
        id: nextPhotoId.current++,
        name: file.name,
        note: "",
        url,
      };
    });

    setPhotos((current) => [...current, ...nextPhotos]);

    if (selectedFiles.length > remaining) {
      setNotice("You can add up to 8 photos.");
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
    if (!started || photos.length > 0 || memoryText.trim().length > 0) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(`.${styles.memoryComposer}`)
    ) {
      return;
    }

    setStarted(false);
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const addButton = (
    <button
      className={styles.addButton}
      type="button"
      aria-label={photos.length === 0 ? "Add photos" : "Add more photos"}
      disabled={photos.length >= MAX_PHOTOS}
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
        onClick={handleSurfaceClick}
      >
        {started ? (
          <>
            <button
              className={`${styles.edgeBack} ${styles.edgeBackLeft}`}
              type="button"
              tabIndex={-1}
              aria-label="Return to the memory question"
              onClick={() => setStarted(false)}
            />
            <button
              className={`${styles.edgeBack} ${styles.edgeBackRight}`}
              type="button"
              tabIndex={-1}
              aria-label="Return to the memory question"
              onClick={() => setStarted(false)}
            />
          </>
        ) : null}

        <div className={styles.stage}>
          <div className={styles.prompt}>
            <motion.button
              className={styles.orb}
              type="button"
              aria-label={
                started
                  ? "Return to the memory question"
                  : "Begin adding a memory"
              }
              layout
              layoutDependency={started}
              transition={layoutTransition}
              onClick={() => setStarted((current) => !current)}
            >
              <AgentOrbVideo
                src="/you-agent-orb.mp4"
                poster="/you-agent-orb-poster.jpg"
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
                  >
                    <div className={styles.composerSplit}>
                      <div className={styles.textWindow}>
                        <textarea
                          className={styles.memoryInput}
                          value={memoryText}
                          maxLength={6000}
                          aria-label="Tell Chapter about this memory"
                          placeholder="Start anywhere. The place, the people, what happened, how it felt… You can also add up to 8 photos, with a little context for each."
                          onChange={(event) => setMemoryText(event.target.value)}
                        />

                        <AnimatePresence initial={false}>
                          {canSend ? (
                            <motion.button
                              className={styles.sendButton}
                              type="submit"
                              aria-label="Send memory to Chapter"
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
                                reduceMotion ? undefined : { y: 2, scale: 0.985 }
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
                                            onClick={() =>
                                              setEditingPhotoId(null)
                                            }
                                          >
                                            Done
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
                                          {photo.note}
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
                      onClick={(event) => event.stopPropagation()}
                      onChange={addPhotos}
                    />
                  </form>

                </div>

                <AnimatePresence initial={false}>
                  {notice ? (
                    <motion.p
                      className={styles.notice}
                      role="status"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {notice}
                    </motion.p>
                  ) : null}
                </AnimatePresence>

              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
