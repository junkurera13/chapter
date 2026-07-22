"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, type PanInfo, useReducedMotion } from "framer-motion";

import ceramicImage from "@/app/assets/ceramics-class.jpg";
import mojikoImage from "@/app/assets/mojiko-waterfront.jpg";
import odysseyImage from "@/app/assets/odyssey-cinema.png";
import sushiImage from "@/app/assets/sushi-shibuya.webp";
import { categoryOrbGradient } from "@/app/app/categoryAppearance";

interface Card {
  id: number;
  orientation: "portrait" | "landscape";
  kind?: "moment" | "ceramics" | "birdwatching" | "sushi" | "odyssey";
  title?: string;
  image: string;
  href?: string;
}

interface Slot {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  zIndex: number;
}

const CARDS: Card[] = [
  {
    id: 0,
    orientation: "portrait",
    kind: "moment",
    title: "A shared ride around Mojiko",
    image: mojikoImage.src,
  },
  {
    id: 1,
    orientation: "landscape",
    kind: "ceramics",
    title: "How about a Ceramics Class in Euljiro this Saturday at 2pm?",
    image: ceramicImage.src,
  },
  {
    id: 2,
    orientation: "portrait",
    kind: "sushi",
    title: "A first Sushi experience in Nishi-Ogikubo",
    image: sushiImage.src,
  },
  {
    id: 3,
    orientation: "landscape",
    kind: "birdwatching",
    title:
      "Jiyoon and Soojin are planning a Birdwatching Session at Sungei Buloh this Sunday morning",
    image:
      "https://ik.imagekit.io/aitoolkit/interactive-card-stack/green-headed-tanager-mossy-branch.jpg",
  },
  {
    id: 4,
    orientation: "portrait",
    kind: "odyssey",
    title: "Four seats for The Odyssey at Babylon",
    image: odysseyImage.src,
  },
];

const SLOTS_DESKTOP: Slot[] = [
  { x: 0, y: 0, rotate: 1.5, scale: 1, zIndex: 50 },
  { x: 160, y: -30, rotate: 12, scale: 0.9, zIndex: 40 },
  { x: -150, y: -10, rotate: -14, scale: 0.89, zIndex: 30 },
  { x: 90, y: 70, rotate: 8, scale: 0.86, zIndex: 20 },
  { x: -110, y: 60, rotate: -9, scale: 0.84, zIndex: 10 },
];

const SLOTS_MOBILE: Slot[] = [
  { x: 0, y: 0, rotate: 1, scale: 1, zIndex: 50 },
  { x: 90, y: -15, rotate: 6, scale: 0.92, zIndex: 40 },
  { x: -85, y: 20, rotate: -7, scale: 0.91, zIndex: 30 },
  { x: 55, y: 35, rotate: 4, scale: 0.88, zIndex: 20 },
  { x: -55, y: 25, rotate: -4.5, scale: 0.87, zIndex: 10 },
];

const SPRING = { type: "spring" as const, stiffness: 280, damping: 26 };
const MOUNT_SPRING = { type: "spring" as const, stiffness: 200, damping: 22 };
const STAGGER_S = 0.08;
const AUTO_ADVANCE_MS = 8000;
const BREATH_Y_FOCUS = [0, -14, 0, 10, 0];
const BREATH_Y_REST = [0, -8, 0, 6, 0];
const BREATH_ROTATE_FOCUS = [0, 1.5, 0, -1.5, 0];
const BREATH_ROTATE_REST = [0, 1, 0, -1, 0];
const SHADOW_FOCUS =
  "0 24px 48px rgba(0,0,0,0.28), 0 6px 14px rgba(0,0,0,0.16)";
const SHADOW_REST =
  "0 12px 28px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.12)";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69753c]";
const CHEVRON_BUTTON =
  "absolute top-1/2 z-[70] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-[#393735] shadow-[0_3px_10px_rgba(0,0,0,0.09)] backdrop-blur-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-[0_4px_13px_rgba(0,0,0,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c94674] active:scale-95 sm:h-10 sm:w-10";

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  paddingRight: 34,
  fontFamily: "var(--font-sidequest-sans), sans-serif",
  fontWeight: 600,
  fontSize: "16px",
  lineHeight: 1.3,
  letterSpacing: "-0.01em",
  color: "#1a1a19",
  textAlign: "left",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minHeight: "2.6em",
};

const CHIP_STYLE: CSSProperties = {
  width: "clamp(28px, 7.5vw, 36px)",
  height: "clamp(28px, 7.5vw, 36px)",
  backgroundColor: "#141312",
  borderRadius: 11,
  boxShadow: "0 8px 18px rgba(0,0,0,0.42), 0 3px 6px rgba(0,0,0,0.30)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const OPEN_CHIP = (
  <span style={CHIP_STYLE}>
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      width="56%"
      height="56%"
      stroke="#F5F1E8"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 L17 7" />
      <path d="M9 7 H17 V15" />
    </svg>
  </span>
);

export default function InteractiveCardStack() {
  const [order, setOrder] = useState<number[]>([0, 1, 3, 2, 4]);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragDelta = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const updateViewport = () => setIsMobile(!mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const focusCard = useCallback((cardId: number) => {
    setOrder((previous) => {
      const index = previous.indexOf(cardId);
      if (index <= 0) return previous;
      return [cardId, ...previous.slice(0, index), ...previous.slice(index + 1)];
    });
  }, []);

  const step = useCallback((direction: 1 | -1) => {
    setOrder((previous) =>
      direction === 1
        ? [...previous.slice(1), previous[0]]
        : [previous[previous.length - 1], ...previous.slice(0, previous.length - 1)],
    );
  }, []);

  useEffect(() => {
    if (reduceMotion || isPaused || !isPageVisible) return;

    const timeout = window.setTimeout(() => step(1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timeout);
  }, [isPageVisible, isPaused, order, reduceMotion, step]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isArrow = event.key === "ArrowRight" || event.key === "ArrowLeft";
      const activeElement = document.activeElement;

      if (
        !isArrow ||
        !activeElement ||
        !containerRef.current?.contains(activeElement)
      ) {
        return;
      }

      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const distance = info.offset.x;
    const velocity = info.velocity.x;

    if (distance < -80 || velocity < -400) step(1);
    else if (distance > 80 || velocity > 400) step(-1);
  };

  const handleBackCardKeyDown =
    (cardId: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusCard(cardId);
    };

  const frontTitle = CARDS.find((card) => card.id === order[0])?.title ?? "";

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative flex w-full flex-col items-center gap-4"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setIsPaused(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setIsPaused(false);
        }}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setIsPaused(false);
          }
        }}
      >
        <div
          role="group"
          aria-label="Interactive card stack"
          className="relative flex w-full select-none items-center justify-center overflow-visible"
          style={{ perspective: "1400px", height: "clamp(380px, 46vw, 470px)" }}
        >
          {CARDS.map((card) => {
            const slotIndex = order.indexOf(card.id);
            const slot = (isMobile ? SLOTS_MOBILE : SLOTS_DESKTOP)[slotIndex];
            const isFocus = slotIndex === 0;
            const isLandscape = card.orientation === "landscape";
            const isMoment = card.kind === "moment";
            const isCeramics = card.kind === "ceramics";
            const isBirdwatching = card.kind === "birdwatching";
            const isSushi = card.kind === "sushi";
            const isOdyssey = card.kind === "odyssey";
            const transition =
              !reduceMotion && !mounted
                ? { ...MOUNT_SPRING, delay: slotIndex * STAGGER_S }
                : SPRING;
            const widthClass = isLandscape
              ? isMobile
                ? "w-[clamp(225px,66vw,285px)]"
                : "w-[clamp(255px,32vw,360px)]"
              : isMobile
                ? "w-[clamp(150px,48vw,205px)]"
                : "w-[clamp(190px,23vw,255px)]";
            const breathY = reduceMotion
              ? 0
              : isFocus
                ? BREATH_Y_FOCUS
                : BREATH_Y_REST;
            const breathRotate = reduceMotion
              ? 0
              : isFocus
                ? BREATH_ROTATE_FOCUS
                : BREATH_ROTATE_REST;

            return (
              <motion.div
                key={card.id}
                tabIndex={0}
                role={isFocus ? undefined : "button"}
                aria-label={
                  isFocus
                    ? `${card.title}, current. Drag or use the arrow keys to change cards.`
                    : `Show ${card.title}`
                }
                className={`absolute rounded-[18px] outline-none ${widthClass} ${isFocus ? RING : RING}`}
                onClick={
                  isFocus
                    ? undefined
                    : (event) => {
                        event.preventDefault();
                        if (Math.abs(dragDelta.current) < 8) focusCard(card.id);
                      }
                }
                onKeyDown={isFocus ? undefined : handleBackCardKeyDown(card.id)}
                onPointerDown={() => {
                  dragDelta.current = 0;
                }}
                drag={isFocus ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDrag={(_event, info) => {
                  dragDelta.current = info.offset.x;
                }}
                onDragEnd={handleDragEnd}
                style={{
                  containerType:
                    isCeramics || isBirdwatching || isSushi || isOdyssey
                      ? "inline-size"
                      : undefined,
                  cursor: isFocus ? "grab" : "pointer",
                  zIndex: slot.zIndex,
                }}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.5, y: 60 }}
                animate={{
                  x: slot.x,
                  y: slot.y,
                  rotate: slot.rotate,
                  scale: slot.scale,
                  opacity: 1,
                }}
                transition={transition}
                whileTap={isFocus ? { cursor: "grabbing" } : undefined}
              >
                <motion.div
                  className={`relative flex w-full flex-col rounded-[18px] ring-1 ring-black/[0.08] ${
                    isMoment ? "aspect-[2/3]" : ""
                  }`}
                  style={{
                    backgroundColor: "#FFFFFF",
                    height: isCeramics
                      ? "calc(68.5px + 62.5cqw)"
                      : isBirdwatching
                        ? "calc(68.5px + 62.5cqw)"
                        : isSushi
                          ? "calc(56px + 125cqw)"
                          : isOdyssey
                            ? "calc(58.6px + 125cqw)"
                            : undefined,
                    padding: 10,
                    boxShadow: isFocus ? SHADOW_FOCUS : SHADOW_REST,
                  }}
                  animate={{ y: breathY, rotate: breathRotate }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 7 + card.id * 0.6,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                  }
                >
                  {isMoment ? (
                    <>
                      <div className="relative px-3 pb-4 pt-3">
                        <p className="m-0 font-[family-name:var(--font-sidequest-sans)] text-[16px] font-normal leading-[1.32] tracking-[-0.025em] text-[#77716f]">
                          You and{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("people"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Samuel
                          </span>{" "}
                          both cycled around{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                            >
                              <path
                                fill="#e5484d"
                                d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
                              />
                              <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
                            </svg>
                            Mojiko
                          </span>{" "}
                          and have a deep connection to this experience.
                        </p>
                      </div>
                      <div
                        className="relative min-h-0 w-full flex-1 overflow-hidden"
                        style={{ borderRadius: 10 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                        <span
                          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(50,30,24,0.16))]"
                          aria-hidden="true"
                        />
                      </div>
                    </>
                  ) : isCeramics ? (
                    <>
                      <div
                        className="relative"
                        style={{ padding: "14px 12px 16px 12px" }}
                      >
                        <p
                          className="text-[16px]"
                          style={{
                            ...TITLE_STYLE,
                            paddingRight: 0,
                            fontSize: undefined,
                            fontWeight: 400,
                            color: "#77716f",
                            WebkitLineClamp: 3,
                          }}
                        >
                          How about a{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("activity"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Ceramics Class
                          </span>{" "}
                          in{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                            >
                              <path
                                fill="#e5484d"
                                d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
                              />
                              <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
                            </svg>
                            Euljiro
                          </span>
                          {" "}
                          <span className="underline decoration-[#77716f]/70 decoration-1 underline-offset-2">
                            this Saturday at 2pm
                          </span>
                          {"?"}
                        </p>
                      </div>
                      <div
                        className="relative min-h-0 w-full flex-1 overflow-hidden"
                        style={{ borderRadius: 10 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                      </div>
                    </>
                  ) : isBirdwatching ? (
                    <>
                      <div className="relative px-3 pb-4 pt-3">
                        <p className="m-0 font-[family-name:var(--font-sidequest-sans)] text-[16px] font-normal leading-[1.3] tracking-[-0.025em] text-[#77716f]">
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("people"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Jiyoon
                          </span>{" "}
                          and{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("people"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Soojin
                          </span>{" "}
                          are planning a{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("activity"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Birdwatching Session
                          </span>{" "}
                          at{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                            >
                              <path
                                fill="#e5484d"
                                d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
                              />
                              <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
                            </svg>
                            Sungei Buloh
                          </span>{" "}
                          this{" "}
                          <span className="underline decoration-[#77716f]/70 decoration-1 underline-offset-2">
                            Sunday morning
                          </span>
                          {". It’s been a while since "}
                          <span className="underline decoration-[#77716f]/70 decoration-1 underline-offset-2">
                            your last one
                          </span>
                          {". Want to join them?"}
                        </p>
                      </div>
                      <div
                        className="relative min-h-0 w-full flex-1 overflow-hidden"
                        style={{ borderRadius: 10 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
                        />
                      </div>
                    </>
                  ) : isSushi ? (
                    <>
                      <div className="relative px-3 pb-4 pt-3">
                        <p className="m-0 font-[family-name:var(--font-sidequest-sans)] text-[16px] font-normal leading-[1.3] tracking-[-0.025em] text-[#77716f]">
                          You&apos;ve never tried{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("interest"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            Sushi
                          </span>
                          {", but I think you’ll like it. This spot in "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                            >
                              <path
                                fill="#e5484d"
                                d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
                              />
                              <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
                            </svg>
                            Nishi-Ogikubo
                          </span>{" "}
                          has Udon and Tempura too, just in case.
                        </p>
                      </div>
                      <div
                        className="relative min-h-0 w-full flex-1 overflow-hidden"
                        style={{ borderRadius: 10 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                      </div>
                    </>
                  ) : isOdyssey ? (
                    <>
                      <div className="relative px-3 pb-4 pt-3">
                        <p className="m-0 font-[family-name:var(--font-sidequest-sans)] text-[16px] font-normal leading-[1.3] tracking-[-0.025em] text-[#77716f]">
                          Your{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              fill="none"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                              stroke="currentColor"
                              strokeWidth="1.45"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="4.5" width="14" height="12" rx="2.2" />
                              <path d="M6.5 2.8v3.1M13.5 2.8v3.1M3 8h14" />
                            </svg>
                            4pm Meeting
                          </span>{" "}
                          moved. There are 4 seats in rows J-K{" "}
                          for{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <span
                              className="relative top-[0.16em] inline-block h-[0.9em] w-[0.9em] rounded-full border border-white/80"
                              style={{
                                background: categoryOrbGradient("interest"),
                                boxShadow:
                                  "inset 3px 4px 5px rgba(255,255,255,0.24), inset -2px -3px 5px rgba(24,17,13,0.18), 0 2px 5px rgba(47,34,24,0.13)",
                              }}
                              aria-hidden="true"
                            />
                            The Odyssey
                          </span>{" "}
                          at{" "}
                          <span className="inline-flex items-baseline gap-0.5 font-semibold text-[#1c1c19]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="relative top-[0.15em] h-[1em] w-[1em] shrink-0"
                            >
                              <path
                                fill="#e5484d"
                                d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
                              />
                              <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
                            </svg>
                            Babylon
                          </span>
                          {". Want to go?"}
                        </p>
                      </div>
                      <div
                        className="relative min-h-0 w-full flex-1 overflow-hidden"
                        style={{ borderRadius: 10 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover object-[center_45%]"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="relative"
                        style={{ padding: "14px 12px 8px 12px" }}
                      >
                        <p style={TITLE_STYLE}>{card.title}</p>
                        {isFocus &&
                          (card.href ? (
                            <motion.a
                              href={card.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${card.title} in a new tab`}
                              className={`absolute right-[10px] top-[10px] leading-none ${RING}`}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={SPRING}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              {OPEN_CHIP}
                            </motion.a>
                          ) : (
                            <motion.span
                              aria-hidden="true"
                              className="absolute right-[10px] top-[10px] leading-none"
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={SPRING}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              {OPEN_CHIP}
                            </motion.span>
                          ))}
                      </div>
                      <div
                        className={`relative w-full overflow-hidden ${
                          isLandscape ? "aspect-[16/10]" : "aspect-[4/5]"
                        }`}
                        style={{ borderRadius: 10 }}
                      >
                        {/* The registry component intentionally uses runtime remote image URLs. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.image}
                          alt=""
                          loading={isFocus ? "eager" : "lazy"}
                          fetchPriority={isFocus ? "high" : "low"}
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            );
          })}

          <button
            type="button"
            aria-label="Previous card"
            className={`${CHEVRON_BUTTON} left-0 sm:left-[clamp(0.25rem,3vw,2rem)]`}
            onClick={() => step(-1)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[18px] w-[18px]"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m14.5 6.5-5 5.5 5 5.5" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Next card"
            className={`${CHEVRON_BUTTON} right-0 sm:right-[clamp(0.25rem,3vw,2rem)]`}
            onClick={() => step(1)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[18px] w-[18px]"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9.5 6.5 5 5.5-5 5.5" />
            </svg>
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {frontTitle ? `${frontTitle} in focus` : ""}
        </p>
      </div>
    </div>
  );
}
