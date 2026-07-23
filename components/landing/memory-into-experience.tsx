"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import {
  motion,
  type MotionStyle,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import * as THREE from "three";

import coastalRideImage from "@/app/assets/coastal-ride-together.webp";
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

import styles from "./memory-into-experience.module.css";

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
      { label: "Earl Grey Ice Cream", category: "interest" },
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
      { label: "Mischief", category: "feeling" },
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
      { label: "Yaki Curry", category: "interest" },
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
};

function StaticMemoryOrb({
  nodeKey,
  category,
  certainty,
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
    const geometry = new THREE.SphereGeometry(1, 52, 38);
    const material = createWorldOrbMaterial(orbNode, texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.set(0.08, -0.35, -0.03);
    scene.add(mesh);

    const render = () => {
      const size = Math.max(1, Math.round(canvas.clientWidth));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size, false);
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
      className={styles.memoryNodeOrb}
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

export default function MemoryIntoExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const messageCopyRef = useRef<HTMLDivElement>(null);
  const messageShownRef = useRef(false);
  const compactLayout = useSyncExternalStore(
    subscribeToCompactLayout,
    getCompactLayoutSnapshot,
    () => false,
  );

  const setSectionRef = useCallback((node: HTMLElement | null) => {
    sectionRef.current = node;
    scrollContainerRef.current = node?.parentElement ?? null;
  }, []);

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const distillationOpacity = useTransform(
    scrollYProgress,
    [0, 0.18, 0.3, 0.34, 1],
    [1, 1, 0, 0, 0],
  );
  const distillationY = useTransform(
    scrollYProgress,
    [0, 0.18, 0.34, 1],
    [0, 0, -12, -12],
  );
  const sentenceScale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.42, 0.72, 1],
    [1, 1, 0.92, 1.08, 1.08],
  );
  const sentenceOpacity = useTransform(
    scrollYProgress,
    [0, 0.26, 0.34, 0.62, 0.75, 1],
    [0, 0, 1, 1, 0, 0],
  );
  const leftSentenceX = useTransform(
    scrollYProgress,
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
    scrollYProgress,
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
    scrollYProgress,
    [0, 0.36, 0.44, 0.58, 1],
    ["0px", "0px", "-76px", "-150px", "-150px"],
  );
  const rightSentenceMobileY = useTransform(
    scrollYProgress,
    [0, 0.36, 0.44, 0.58, 1],
    ["0px", "0px", "76px", "150px", "150px"],
  );

  const imageOpacity = useTransform(
    scrollYProgress,
    [0, 0.36, 0.4, 1],
    [0, 0, 1, 1],
  );
  const imageClipPath = useTransform(
    scrollYProgress,
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
    scrollYProgress,
    [0, 0.37, 0.56, 0.8, 1],
    [0.92, 0.92, 0.97, 1, 1],
  );
  const echoOpacity = useTransform(
    scrollYProgress,
    [0, 0.42, 0.5, 0.66, 0.72, 1],
    [0, 0, 0.2, 0.13, 0, 0],
  );
  const echoOneScale = useTransform(
    scrollYProgress,
    [0, 0.42, 0.68, 1],
    [0.84, 0.84, 1.035, 1.035],
  );
  const echoTwoScale = useTransform(
    scrollYProgress,
    [0, 0.42, 0.68, 1],
    [0.76, 0.76, 1.07, 1.07],
  );

  const veilOpacity = useTransform(
    scrollYProgress,
    [0, 0.72, 0.83, 1],
    [0, 0, 1, 1],
  );
  const resultOpacity = useTransform(
    scrollYProgress,
    [0, 0.79, 0.85, 1],
    [0, 0, 1, 1],
  );
  const resultY = useTransform(
    scrollYProgress,
    [0, 0.79, 0.85, 1],
    [14, 14, 0, 0],
  );
  const resultBlur = useTransform(
    scrollYProgress,
    [0, 0.79, 0.85, 1],
    ["blur(3px)", "blur(3px)", "blur(0px)", "blur(0px)"],
  );
  const messageOpacity = useTransform(
    scrollYProgress,
    [0, 0.87, 0.94, 1],
    [0, 0, 1, 1],
  );
  const messageY = useTransform(
    scrollYProgress,
    [0, 0.87, 0.94, 1],
    [34, 34, 0, 0],
  );
  const messageScale = useTransform(
    scrollYProgress,
    [0, 0.87, 0.94, 1],
    [0.97, 0.97, 1, 1],
  );

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextShown = latest >= 0.91;
    if (messageShownRef.current === nextShown) return;
    messageShownRef.current = nextShown;
    messageCopyRef.current?.classList.toggle("is-shown", nextShown);
    messageCopyRef.current?.classList.toggle("is-hiding", !nextShown);
  });

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
              progress={scrollYProgress}
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
            src={coastalRideImage}
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
            src={coastalRideImage}
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
            src={coastalRideImage}
            alt="Two people riding bicycles down a quiet coastal road toward the sea"
            fill
            sizes="100vw"
            placeholder="blur"
            priority={false}
          />
        </motion.div>

        <motion.div
          className={styles.imageVeil}
          style={{ opacity: veilOpacity }}
          aria-hidden="true"
        />

        <div className={styles.storyCopy}>
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
        </div>

        <motion.p
          className={styles.resultCopy}
          style={{
            opacity: resultOpacity,
            y: resultY,
            filter: resultBlur,
          }}
        >
          So new experiences feel like you, without repeating what came before.
        </motion.p>

        <motion.article
          className={styles.messageCard}
          style={{
            opacity: messageOpacity,
            y: messageY,
            scale: messageScale,
          }}
          aria-label="A message from Sidequest"
        >
          <header className={styles.messageHeader}>
            <span className={styles.messageMark} aria-hidden="true">
              <Image
                src="/sidequest-mark.svg"
                alt=""
                width={30}
                height={30}
              />
            </span>
            <span>
              <strong>Sidequest</strong>
              <small>This weekend</small>
            </span>
          </header>

          <div
            ref={messageCopyRef}
            className="t-stagger is-hiding"
          >
            <p
              className={`${styles.messageTitle} t-stagger-line t-stagger-line--1`}
            >
              Take the long way to the sea.
            </p>
            <p
              className={`${styles.messageBody} t-stagger-line t-stagger-line--2`}
            >
              Ride the coast before sunset. Stop when something looks good.
              There&apos;s no schedule after that.
            </p>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
