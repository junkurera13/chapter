"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import {
  AnimatePresence,
  motion,
  type MotionStyle,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import * as THREE from "three";

import coastalRideSoloImage from "@/app/assets/coastal-ride-solo.jpg";
import coastalRideTogetherImage from "@/app/assets/coastal-ride-together-hq-2x.png";
import earlGreyIceCreamImage from "@/app/assets/mojiko-memory/earl-grey-ice-cream.webp";
import friendsBikesBridgeImage from "@/app/assets/mojiko-memory/friends-bikes-bridge.webp";
import friendsWaterfrontImage from "@/app/assets/mojiko-memory/friends-waterfront.webp";
import harbourCyclingImage from "@/app/assets/mojiko-memory/harbour-cycling.webp";
import railwayMuseumImage from "@/app/assets/mojiko-memory/railway-museum.webp";
import stationImage from "@/app/assets/mojiko-memory/station.webp";
import waterfrontSunsetImage from "@/app/assets/mojiko-memory/waterfront-sunset.webp";
import yakiCurryImage from "@/app/assets/mojiko-memory/yaki-curry.webp";
import {
  createWorldOrbMaterial,
  createWorldOrbTexture,
} from "@/app/app/orbMaterial";
import type { WorldNodeCategory } from "@/app/app/graphData";

import AgentOrbVideo from "./agent-orb-video";
import styles from "./memory-into-experience.module.css";

function PlacePinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={styles.placePin}
    >
      <path
        fill="#e5484d"
        d="M10 1.5A6.1 6.1 0 0 0 3.9 7.6c0 4.45 5.37 9.62 5.6 9.84a.72.72 0 0 0 1 0c.23-.22 5.6-5.39 5.6-9.84A6.1 6.1 0 0 0 10 1.5Z"
      />
      <circle cx="10" cy="7.45" r="2.15" fill="#fff" />
    </svg>
  );
}

const STORY_END_PROGRESS = 0.68;
const CONNECTION_START_PROGRESS = 0.8;
const CONNECTION_THINKING_MS = 1800;
const RESULT_ROWS = [
  "So new experiences feel like you,",
  "without ever feeling like anything",
  "you’ve done before.",
] as const;
const CONNECTION_ROWS = [
  "Some are yours alone.",
  "Some bring friends closer.",
  "Some introduce you to new ones.",
  "Some might even lead to love.",
] as const;
const CONNECTION_EASE = [0.22, 1, 0.36, 1] as const;

type ConnectionPhase = "quiet" | "thinking" | "revealed";

type MemoryNodeDefinition = {
  label: string;
  category: WorldNodeCategory;
  certainty?: "fact" | "hypothesis";
};

type MemoryFragmentDefinition = {
  id: string;
  className: string;
  image: StaticImageData;
  objectPosition: string;
  imageScale?: number;
  imageTranslateX?: number;
  imageTranslateY?: number;
  driftX: number;
  driftY: number;
  rotation: number;
  nodes: readonly MemoryNodeDefinition[];
  hiddenNodeCount?: number;
};

const MEMORY_FRAGMENTS: MemoryFragmentDefinition[] = [
  {
    id: "hill",
    className: styles.fragmentHill,
    image: waterfrontSunsetImage,
    objectPosition: "50% 60%",
    driftX: -90,
    driftY: -240,
    rotation: 0,
    nodes: [
      { label: "Mojiko Waterfront", category: "place" },
    ],
  },
  {
    id: "boat",
    className: styles.fragmentBoat,
    image: earlGreyIceCreamImage,
    objectPosition: "50% 78%",
    imageScale: 1.18,
    imageTranslateY: -9,
    driftX: 210,
    driftY: -210,
    rotation: 0,
    nodes: [
      { label: "Earl Grey Ice Cream", category: "activity" },
    ],
    hiddenNodeCount: 2,
  },
  {
    id: "wake",
    className: styles.fragmentWake,
    image: friendsBikesBridgeImage,
    objectPosition: "50% 54%",
    driftX: 260,
    driftY: -90,
    rotation: 0,
    nodes: [
      { label: "Aron", category: "people" },
      { label: "Samuel", category: "people" },
    ],
    hiddenNodeCount: 2,
  },
  {
    id: "promenade",
    className: styles.fragmentPromenade,
    image: railwayMuseumImage,
    objectPosition: "48% 55%",
    driftX: 250,
    driftY: 190,
    rotation: 0,
    nodes: [
      { label: "Kyushu Railway Museum", category: "place" },
    ],
    hiddenNodeCount: 1,
  },
  {
    id: "horizon",
    className: styles.fragmentHorizon,
    image: harbourCyclingImage,
    objectPosition: "50% 68%",
    imageScale: 1.06,
    driftX: 100,
    driftY: 240,
    rotation: 0,
    nodes: [
      { label: "Cycling", category: "activity" },
      { label: "Daniel", category: "people" },
    ],
    hiddenNodeCount: 2,
  },
  {
    id: "lower-left",
    className: styles.fragmentLowerLeft,
    image: friendsWaterfrontImage,
    objectPosition: "50% 52%",
    imageScale: 1.06,
    imageTranslateX: 3,
    driftX: -240,
    driftY: 200,
    rotation: 0,
    nodes: [
      { label: "Mischief", category: "activity" },
      { label: "Shinmog", category: "people" },
    ],
  },
  {
    id: "lower-small",
    className: styles.fragmentLowerSmall,
    image: yakiCurryImage,
    objectPosition: "50% 63%",
    driftX: -130,
    driftY: 250,
    rotation: 0,
    nodes: [
      { label: "Yaki Curry", category: "activity" },
    ],
  },
  {
    id: "middle-left",
    className: styles.fragmentMiddleLeft,
    image: stationImage,
    objectPosition: "50% 45%",
    driftX: -260,
    driftY: 35,
    rotation: 0,
    nodes: [
      {
        label: "Mojiko Station",
        category: "place",
      },
    ],
  },
];

function subscribeToCompactLayout(onChange: () => void) {
  const query = window.matchMedia("(max-width: 640px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getCompactLayoutSnapshot() {
  return window.matchMedia("(max-width: 640px)").matches;
}

type MemoryFragmentProps = {
  definition: MemoryFragmentDefinition;
  progress: MotionValue<number>;
};

type StaticMemoryOrbProps = {
  nodeKey: string;
  category: WorldNodeCategory;
  certainty: "fact" | "hypothesis";
  className?: string;
};

function StaticMemoryOrb({
  nodeKey,
  category,
  certainty,
  className,
}: StaticMemoryOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -1.16,
      1.16,
      1.16,
      -1.16,
      0.1,
      10,
    );
    camera.position.z = 4;

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-3, 5, 8);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xdde7ff, 0.75);
    fillLight.position.set(5, -2, 5);
    scene.add(fillLight);

    const orbNode = { key: nodeKey, category, certainty };
    const texture = createWorldOrbTexture(orbNode);
    if (texture) {
      // Keep surface detail when the canvas is CSS-scaled down to chip size.
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    }
    // Denser mesh so small chips don't show facet edges after supersampling.
    const geometry = new THREE.SphereGeometry(1, 64, 48);
    const material = createWorldOrbMaterial(orbNode, texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.set(0.08, -0.35, -0.03);
    scene.add(mesh);

    const render = () => {
      const cssSize = Math.max(1, canvas.clientWidth);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      // Inline chips are ~1em wide; render a much larger buffer and let CSS
      // downscale so the planet surface stays crisp (not chunky pixels).
      const bufferSize = Math.max(160, Math.round(cssSize * dpr * 3));
      renderer.setPixelRatio(1);
      renderer.setSize(bufferSize, bufferSize, false);
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(canvas);
    render();

    return () => {
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      texture?.dispose();
      renderer.dispose();
    };
  }, [category, certainty, nodeKey]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? styles.memoryNodeOrb}
      aria-hidden="true"
    />
  );
}

function MemoryFragment({
  definition,
  progress,
}: MemoryFragmentProps) {
  const x = useTransform(
    progress,
    [0, 0.48, 1],
    [0, definition.driftX, definition.driftX],
  );
  const y = useTransform(
    progress,
    [0, 0.48, 1],
    [0, definition.driftY, definition.driftY],
  );
  const scale = useTransform(
    progress,
    [0, 0.3, 0.48, 1],
    [1, 0.76, 0.48, 0.48],
  );
  const rotate = useTransform(
    progress,
    [0, 0.48, 1],
    [
      definition.rotation,
      definition.rotation * 1.8,
      definition.rotation * 1.8,
    ],
  );
  const opacity = useTransform(
    progress,
    [0, 0.24, 0.46, 0.5, 1],
    [1, 0.9, 0.18, 0, 0],
  );
  const filter = useTransform(
    progress,
    [0, 0.36, 0.5, 1],
    ["blur(0px)", "blur(0px)", "blur(7px)", "blur(7px)"],
  );
  const nodeOpacity = useTransform(
    progress,
    [0, 0.28, 0.43, 0.49, 1],
    [1, 0.92, 0.2, 0, 0],
  );
  const magneticTargetX = useMotionValue(0);
  const magneticTargetY = useMotionValue(0);
  const magneticX = useSpring(magneticTargetX, {
    stiffness: 250,
    damping: 26,
    mass: 0.55,
  });
  const magneticY = useSpring(magneticTargetY, {
    stiffness: 250,
    damping: 26,
    mass: 0.55,
  });
  const prefersReducedMotion = useReducedMotion();

  const resetMagnet = useCallback(() => {
    magneticTargetX.set(0);
    magneticTargetY.set(0);
  }, [magneticTargetX, magneticTargetY]);

  const followPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || event.pointerType !== "mouse") return;

      const bounds = event.currentTarget.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const normalizedX =
        (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
      const normalizedY =
        (event.clientY - bounds.top - bounds.height / 2) /
        (bounds.height / 2);
      const maxPullX = Math.min(20, bounds.width * 0.11);
      const maxPullY = Math.min(16, bounds.height * 0.09);

      magneticTargetX.set(normalizedX * maxPullX);
      magneticTargetY.set(normalizedY * maxPullY);
    },
    [magneticTargetX, magneticTargetY, prefersReducedMotion],
  );

  return (
    <motion.div
      className={`${styles.fragmentAnchor} ${definition.className}`}
      data-memory-fragment={definition.id}
      style={{ x, y, scale, rotate, opacity, filter }}
      onPointerMove={followPointer}
      onPointerLeave={resetMagnet}
      onPointerCancel={resetMagnet}
      aria-hidden="true"
    >
      <motion.div
        className={styles.fragmentShell}
        style={{ x: magneticX, y: magneticY }}
      >
        <motion.div
          className={styles.nodeField}
          data-node-count={definition.nodes.length}
          style={{ opacity: nodeOpacity }}
        >
          {definition.nodes.map((node) => (
            <span
              key={`${definition.id}-${node.label}`}
              className={styles.memoryNode}
              data-certainty={node.certainty ?? "fact"}
            >
              <StaticMemoryOrb
                nodeKey={`${definition.id}-${node.label}`}
                category={node.category}
                certainty={node.certainty ?? "fact"}
              />
              <span className={styles.memoryNodeLabel}>{node.label}</span>
            </span>
          ))}
          {definition.hiddenNodeCount ? (
            <span
              className={`${styles.memoryNodeLabel} ${styles.overflowNodeCount}`}
            >
              +{definition.hiddenNodeCount}
            </span>
          ) : null}
        </motion.div>

        <figure className={styles.fragment}>
          <Image
            src={definition.image}
            alt=""
            fill
            sizes="(max-width: 640px) 32vw, 20vw"
            placeholder="blur"
            style={{
              objectPosition: definition.objectPosition,
              transform: `translate(${definition.imageTranslateX ?? 0}%, ${definition.imageTranslateY ?? 0}%) scale(${definition.imageScale ?? 1})`,
            }}
          />
        </figure>
      </motion.div>
    </motion.div>
  );
}

function QuestSuggestionCopy() {
  return (
    <p className={styles.questLine}>
      How about a peaceful{" "}
      <span className={styles.entity}>
        <StaticMemoryOrb
          nodeKey="quest-cycling"
          category="activity"
          certainty="fact"
          className={styles.entityOrb}
        />
        Cycling
      </span>{" "}
      path around{" "}
      <span className={styles.entity}>
        <PlacePinIcon />
        Han River
      </span>
      ?
    </p>
  );
}

function ConnectionUpdate({
  phase,
  reduceMotion,
}: {
  phase: ConnectionPhase;
  reduceMotion: boolean;
}) {
  return (
    <div className={styles.connectionSlot} aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {phase === "thinking" ? (
          <motion.div
            key="thinking"
            className={styles.connectionUpdate}
            initial={{ opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
            transition={{
              duration: reduceMotion ? 0 : 0.25,
              ease: "easeInOut",
            }}
          >
            <span
              className={styles.thinkingIndicator}
              role="status"
              aria-label="Chapter is thinking"
            >
              <AgentOrbVideo />
            </span>
          </motion.div>
        ) : null}

        {phase === "revealed" ? (
          <motion.div
            key="connection"
            className={styles.connectionUpdate}
            initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -5, filter: "blur(2px)" }}
            transition={{
              duration: reduceMotion ? 0 : 0.48,
              ease: CONNECTION_EASE,
            }}
          >
            <p className={`${styles.questLine} ${styles.connectionLine}`}>
              Oh, btw,{" "}
              <span className={styles.entity}>
                <StaticMemoryOrb
                  nodeKey="quest-olivia"
                  category="people"
                  certainty="fact"
                  className={styles.entityOrb}
                />
                Olivia
              </span>
              &apos;s calendar is free{" "}
              <span className={styles.timeMark}>this Saturday</span>. Want to go
              together?
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function cardLabelForPhase(phase: ConnectionPhase) {
  if (phase === "thinking") {
    return "Chapter: peaceful cycling path around Han River. Chapter is thinking.";
  }

  if (phase === "revealed") {
    return "Chapter: peaceful cycling path around Han River with Olivia";
  }

  return "Chapter: peaceful cycling path around Han River";
}

export default function MemoryIntoExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const scrollYProgress = useMotionValue(0);
  const [connectionPhase, setConnectionPhase] =
    useState<ConnectionPhase>("quiet");
  const reduceMotion = useReducedMotion();
  const compactLayout = useSyncExternalStore(
    subscribeToCompactLayout,
    getCompactLayoutSnapshot,
    () => false,
  );

  const setSectionRef = useCallback(
    (node: HTMLElement | null) => {
      sectionRef.current = node;
      scrollContainerRef.current = node?.parentElement ?? null;

      const container = scrollContainerRef.current;
      if (!node || !container) return;

      let frame = 0;
      const updateProgress = () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const travel = Math.max(1, node.offsetHeight - container.clientHeight);
          const progress = (container.scrollTop - node.offsetTop) / travel;
          scrollYProgress.set(Math.min(1, Math.max(0, progress)));
        });
      };

      const resizeObserver = new ResizeObserver(updateProgress);
      resizeObserver.observe(node);
      resizeObserver.observe(container);
      container.addEventListener("scroll", updateProgress, { passive: true });
      updateProgress();

      return () => {
        window.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        container.removeEventListener("scroll", updateProgress);
        sectionRef.current = null;
        scrollContainerRef.current = null;
      };
    },
    [scrollYProgress],
  );

  const storyProgress = useTransform(
    scrollYProgress,
    [0, STORY_END_PROGRESS],
    [0, 1],
    { clamp: true },
  );

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (reduceMotion) return;

    setConnectionPhase((currentPhase) => {
      if (progress < CONNECTION_START_PROGRESS) {
        return currentPhase === "quiet" ? currentPhase : "quiet";
      }

      return currentPhase === "quiet" ? "thinking" : currentPhase;
    });
  });

  useEffect(() => {
    if (reduceMotion || connectionPhase !== "thinking") return;

    const revealTimer = window.setTimeout(() => {
      setConnectionPhase("revealed");
    }, CONNECTION_THINKING_MS);

    return () => window.clearTimeout(revealTimer);
  }, [connectionPhase, reduceMotion]);

  const displayedConnectionPhase = reduceMotion
    ? "revealed"
    : connectionPhase;

  const distillationOpacity = useTransform(
    storyProgress,
    [0, 0.18, 0.3, 0.34, 1],
    [1, 1, 0, 0, 0],
  );
  const distillationY = useTransform(
    storyProgress,
    [0, 0.18, 0.34, 1],
    [0, 0, -12, -12],
  );
  const sentenceScale = useTransform(
    storyProgress,
    [0, 0.3, 0.42, 0.72, 1],
    [1, 1, 0.92, 1.08, 1.08],
  );
  const sentenceOpacity = useTransform(
    storyProgress,
    [0, 0.26, 0.34, 0.62, 0.75, 1],
    [0, 0, 1, 1, 0, 0],
  );
  const leftSentenceX = useTransform(
    storyProgress,
    [0, 0.38, 0.58, 0.73, 1],
    [
      "0px",
      "0px",
      compactLayout ? "-150px" : "-22vw",
      compactLayout ? "-230px" : "-32vw",
      compactLayout ? "-230px" : "-32vw",
    ],
  );
  const rightSentenceX = useTransform(
    storyProgress,
    [0, 0.38, 0.58, 0.73, 1],
    [
      0,
      0,
      compactLayout ? 140 : 300,
      compactLayout ? 260 : 400,
      compactLayout ? 260 : 400,
    ],
  );
  const leftSentenceMobileY = useTransform(
    storyProgress,
    [0, 0.36, 0.44, 0.58, 1],
    ["0px", "0px", "-76px", "-150px", "-150px"],
  );
  const rightSentenceMobileY = useTransform(
    storyProgress,
    [0, 0.36, 0.44, 0.58, 1],
    ["0px", "0px", "76px", "150px", "150px"],
  );

  const imageOpacity = useTransform(
    storyProgress,
    [0, 0.36, 0.4, 1],
    [0, 0, 1, 1],
  );
  const imageClipPath = useTransform(
    storyProgress,
    [0, 0.37, 0.48, 0.62, 0.8, 1],
    [
      "inset(47% 48.6% 47% 48.6% round 22px)",
      "inset(47% 48.6% 47% 48.6% round 22px)",
      "inset(41% 43% 41% 43% round 24px)",
      "inset(25% 29% 25% 29% round 30px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
    ],
  );
  const imageScale = useTransform(
    storyProgress,
    [0, 0.37, 0.56, 0.8, 1],
    [0.92, 0.92, 0.97, 1, 1],
  );
  const echoOpacity = useTransform(
    storyProgress,
    [0, 0.42, 0.5, 0.66, 0.72, 1],
    [0, 0, 0.2, 0.13, 0, 0],
  );
  const echoOneScale = useTransform(
    storyProgress,
    [0, 0.42, 0.68, 1],
    [0.84, 0.84, 1.035, 1.035],
  );
  const echoTwoScale = useTransform(
    storyProgress,
    [0, 0.42, 0.68, 1],
    [0.76, 0.76, 1.07, 1.07],
  );

  const veilOpacity = useTransform(
    storyProgress,
    [0, 0.72, 0.83, 1],
    [0, 0, 1, 1],
  );
  const resultOpacity = useTransform(
    storyProgress,
    [0, 0.79, 0.85, 1],
    [0, 0, 1, 1],
  );
  const resultY = useTransform(
    storyProgress,
    [0, 0.79, 0.85, 1],
    [14, 14, 0, 0],
  );
  const resultBlur = useTransform(
    storyProgress,
    [0, 0.79, 0.85, 1],
    ["blur(3px)", "blur(3px)", "blur(0px)", "blur(0px)"],
  );
  const experienceResultOpacity = useTransform(
    scrollYProgress,
    [0, 0.72, 0.79, 1],
    [1, 1, 0, 0],
  );
  const experienceResultY = useTransform(
    scrollYProgress,
    [0, 0.72, 0.79, 1],
    [0, 0, -8, -8],
  );
  const experienceResultBlur = useTransform(
    scrollYProgress,
    [0, 0.72, 0.79, 1],
    ["blur(0px)", "blur(0px)", "blur(3px)", "blur(3px)"],
  );
  const connectionResultOpacity = useTransform(
    scrollYProgress,
    [0, 0.76, 0.83, 1],
    [0, 0, 1, 1],
  );
  const connectionResultY = useTransform(
    scrollYProgress,
    [0, 0.76, 0.83, 1],
    [12, 12, 0, 0],
  );
  const connectionResultBlur = useTransform(
    scrollYProgress,
    [0, 0.76, 0.83, 1],
    ["blur(3px)", "blur(3px)", "blur(0px)", "blur(0px)"],
  );
  const messageOpacity = useTransform(
    storyProgress,
    [0, 0.87, 0.94, 1],
    [0, 0, 1, 1],
  );
  const messageY = useTransform(
    storyProgress,
    [0, 0.87, 0.94, 1],
    [34, 34, 0, 0],
  );
  const messageScale = useTransform(
    storyProgress,
    [0, 0.87, 0.94, 1],
    [0.97, 0.97, 1, 1],
  );

  return (
    <section
      ref={setSectionRef}
      className={styles.section}
      aria-labelledby="memory-experience-title"
    >
      <div className={styles.stickyStage}>
        <div className={styles.fragmentField} aria-hidden="true">
          {MEMORY_FRAGMENTS.map((fragment) => (
            <MemoryFragment
              key={fragment.id}
              definition={fragment}
              progress={storyProgress}
            />
          ))}
        </div>

        <motion.div
          className={`${styles.experienceFrame} ${styles.echoFrame} ${styles.echoFrameOne}`}
          style={{
            clipPath: imageClipPath,
            opacity: echoOpacity,
            scale: echoOneScale,
          }}
          aria-hidden="true"
        >
          <Image
            src={coastalRideSoloImage}
            alt=""
            fill
            sizes="100vw"
            placeholder="blur"
          />
        </motion.div>

        <motion.div
          className={`${styles.experienceFrame} ${styles.echoFrame} ${styles.echoFrameTwo}`}
          style={{
            clipPath: imageClipPath,
            opacity: echoOpacity,
            scale: echoTwoScale,
          }}
          aria-hidden="true"
        >
          <Image
            src={coastalRideSoloImage}
            alt=""
            fill
            sizes="100vw"
            placeholder="blur"
          />
        </motion.div>

        <motion.div
          className={styles.experienceFrame}
          style={{
            clipPath: imageClipPath,
            opacity: imageOpacity,
            scale: imageScale,
          }}
        >
          <Image
            className={styles.experienceImage}
            src={coastalRideSoloImage}
            alt={
              displayedConnectionPhase === "revealed"
                ? ""
                : "One person riding a bicycle alone down a quiet coastal road toward the sea"
            }
            fill
            sizes="100vw"
            placeholder="blur"
            priority={false}
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {displayedConnectionPhase === "revealed" ? (
            <motion.div
              key="together-scene"
              className={`${styles.experienceFrame} ${styles.togetherFrame}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.65,
                ease: CONNECTION_EASE,
              }}
            >
              <Image
                className={styles.experienceImage}
                src={coastalRideTogetherImage}
                alt="Two people riding bicycles down a quiet coastal road toward the sea"
                fill
                sizes="100vw"
                placeholder="blur"
                quality={90}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          className={styles.imageVeil}
          style={{ opacity: veilOpacity }}
          aria-hidden="true"
        />

        <motion.div
          className={styles.storyCopy}
          initial={{ opacity: 0, y: 12, filter: "blur(3px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ root: scrollContainerRef, amount: 0.55 }}
          transition={{
            delay: 0.06,
            duration: 1.3,
            ease: "easeInOut",
          }}
        >
          <motion.div
            className={styles.storyPhase}
            style={{ opacity: distillationOpacity, y: distillationY }}
          >
            <h2
              id="memory-experience-title"
              className={`${styles.sentence} ${styles.distillationSentence}`}
            >
              Each memory is distilled into what made it meaningful.
            </h2>
          </motion.div>

          <motion.div
            className={styles.storyPhase}
            style={{ scale: sentenceScale, opacity: sentenceOpacity }}
          >
            <p
              className={styles.sentence}
              aria-label="Then it’s added to your world."
            >
              <motion.span
                style={
                  {
                    x: leftSentenceX,
                    "--mobile-sentence-y": leftSentenceMobileY,
                  } as MotionStyle
                }
                aria-hidden="true"
              >
                Then it’s added
              </motion.span>
              <motion.span
                style={
                  {
                    x: rightSentenceX,
                    "--mobile-sentence-y": rightSentenceMobileY,
                  } as MotionStyle
                }
                aria-hidden="true"
              >
                to your world.
              </motion.span>
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className={styles.resultCopy}
          style={{
            opacity: resultOpacity,
            y: resultY,
            filter: resultBlur,
          }}
        >
          <motion.p
            className={`${styles.resultSlide} ${styles.experienceResult}`}
            style={{
              opacity: experienceResultOpacity,
              y: experienceResultY,
              filter: experienceResultBlur,
            }}
          >
            {RESULT_ROWS.map((row) => (
              <span key={row} className={styles.resultRow}>
                {row}
              </span>
            ))}
          </motion.p>
        </motion.div>

        <motion.div
          className={styles.resultCopy}
          style={{
            opacity: connectionResultOpacity,
            y: connectionResultY,
            filter: connectionResultBlur,
          }}
        >
          <p className={styles.resultSlide}>
            {CONNECTION_ROWS.map((row) => (
              <span key={row} className={styles.resultRow}>
                {row}
              </span>
            ))}
          </p>
        </motion.div>

        <motion.article
          layout={reduceMotion ? false : "size"}
          className={styles.questCard}
          style={{
            opacity: messageOpacity,
            y: messageY,
            scale: messageScale,
          }}
          transition={{
            layout: { duration: 0.5, ease: CONNECTION_EASE },
          }}
          aria-label={cardLabelForPhase(displayedConnectionPhase)}
        >
          <header className={styles.questHeader}>
            <span className={styles.questMark} aria-hidden="true">
              <Image
                src="/chapter-mark.svg"
                alt=""
                width={30}
                height={30}
              />
            </span>
            <span className={styles.questBrand}>
              <strong>Chapter</strong>
            </span>
          </header>

          <motion.div layout="position" className={styles.questInner}>
            <motion.div layout="position" className={styles.questBody}>
              <QuestSuggestionCopy />
              <ConnectionUpdate
                phase={displayedConnectionPhase}
                reduceMotion={Boolean(reduceMotion)}
              />
            </motion.div>

            <motion.div layout="position" className={styles.questImage}>
              <Image
                src={coastalRideSoloImage}
                alt=""
                fill
                sizes="(max-width: 640px) 88vw, 320px"
                placeholder="blur"
                style={{ objectPosition: "center 40%" }}
              />
              <AnimatePresence initial={false}>
                {displayedConnectionPhase === "revealed" ? (
                  <motion.div
                    key="card-together-image"
                    className={styles.questImageOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.65,
                      ease: CONNECTION_EASE,
                    }}
                    aria-hidden="true"
                  >
                    <Image
                      src={coastalRideTogetherImage}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 88vw, 320px"
                      placeholder="blur"
                      quality={90}
                      style={{ objectPosition: "center 40%" }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.article>
      </div>
    </section>
  );
}
