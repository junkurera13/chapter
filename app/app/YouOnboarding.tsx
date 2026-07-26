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
  useEffect,
  useRef,
  useState,
} from "react";

import ceramicsImage from "../assets/ceramics-class.jpg";
import mojikoImage from "../assets/mojiko-waterfront.jpg";
import sushiImage from "../assets/sushi-shibuya.webp";
import AgentOrbVideo from "../../components/landing/agent-orb-video";

import styles from "./YouOnboarding.module.css";

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 10;

type MemoryPhoto = {
  id: number;
  name: string;
  note: string;
  url: string;
};

export default function YouOnboarding() {
  const [started, setStarted] = useState(false);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
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

    const nextCount = photos.length + nextPhotos.length;
    if (selectedFiles.length > remaining) {
      setNotice("You can add up to 10 photos.");
    } else if (nextCount < MIN_PHOTOS) {
      setNotice("Add at least one more photo.");
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
    setNotice(
      nextPhotos.length > 0 && nextPhotos.length < MIN_PHOTOS
        ? "Add at least one more photo."
        : "",
    );
  }

  function updateNote(photoId: number, note: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, note } : photo,
      ),
    );
  }

  return (
    <LayoutGroup>
      <div className={styles.onboarding} data-started={started}>
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
                  key={started ? "photos" : "invitation"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.12 : 0.34,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {started
                    ? "Add 2–10 photos from that moment."
                    : "What’s a moment that still feels like yesterday?"}
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
                <div className={styles.uploadPrompt}>
                  <div className={styles.memoryWindow} aria-hidden="true">
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

                    <div className={styles.addRow}>
                      <button
                        className={styles.addButton}
                        type="button"
                        aria-label={
                          photos.length === 0 ? "Add photos" : "Add more photos"
                        }
                        disabled={photos.length >= MAX_PHOTOS}
                        onClick={openPhotoPicker}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span>Add</span>
                      </button>

                      {photos.length > 0 ? (
                        <span className={styles.photoCount}>
                          {photos.length} of {MAX_PHOTOS}
                        </span>
                      ) : null}

                      <input
                        ref={inputRef}
                        className={styles.fileInput}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={addPhotos}
                      />
                    </div>
                  </div>
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

                {photos.length > 0 ? (
                  <motion.div className={styles.photoGrid} layout>
                    <AnimatePresence initial={false}>
                      {photos.map((photo, index) => (
                        <motion.article
                          className={styles.photoCard}
                          key={photo.id}
                          layout
                          initial={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 24, scale: 0.96 }
                          }
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, y: 10, scale: 0.97 }
                          }
                          transition={{
                            layout: layoutTransition,
                            opacity: {
                              duration: reduceMotion ? 0.12 : 0.24,
                              delay: reduceMotion
                                ? 0
                                : Math.min(index * 0.045, 0.22),
                            },
                            y: {
                              duration: reduceMotion ? 0 : 0.38,
                              delay: reduceMotion
                                ? 0
                                : Math.min(index * 0.045, 0.22),
                              ease: [0.22, 1, 0.36, 1],
                            },
                            scale: {
                              duration: reduceMotion ? 0 : 0.38,
                              delay: reduceMotion
                                ? 0
                                : Math.min(index * 0.045, 0.22),
                              ease: [0.22, 1, 0.36, 1],
                            },
                          }}
                        >
                          <textarea
                            className={styles.note}
                            value={photo.note}
                            maxLength={280}
                            aria-label={`Context for ${photo.name}`}
                            placeholder="Add a note (optional)"
                            onChange={(event) =>
                              updateNote(photo.id, event.target.value)
                            }
                          />

                          <div className={styles.photo}>
                            {/* Blob URLs are local previews and cannot use the Next image optimizer. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt="" />
                            <button
                              className={styles.removeButton}
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
                          </div>
                        </motion.article>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
