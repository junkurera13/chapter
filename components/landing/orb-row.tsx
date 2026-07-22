"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  createWorldOrbMaterial,
  createWorldOrbTexture,
} from "@/app/app/orbMaterial";
import {
  EXPERIENCE_CATEGORY_META,
  EXPERIENCE_NODE_CATEGORIES,
} from "@/lib/experienceOntology";

import styles from "./orb-row.module.css";

const ORB_REVEAL_MS = 600;
const ORB_PAUSE_MS = 100;
const ORB_STAGGER_MS = ORB_REVEAL_MS + ORB_PAUSE_MS;
const LABEL_DELAY_MS = 0;
const DESCRIPTION_DELAY_MS = ORB_PAUSE_MS;

const ORBS = EXPERIENCE_NODE_CATEGORIES.filter(
  (category) => category !== "experience",
).map((category) => ({
  key: `landing-${category}`,
  label: EXPERIENCE_CATEGORY_META[category].label,
  category,
}));

const ARC_PROFILE = [1, 0.56, 0.18, 0, 0.18, 0.56, 1] as const;

type OrbRowProps = {
  onRevealComplete?: () => void;
};

export default function OrbRow({ onRevealComplete }: OrbRowProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.z = 500;

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-3, 5, 8);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xdde7ff, 0.75);
    fillLight.position.set(5, -2, 5);
    scene.add(fillLight);

    const textures: THREE.Texture[] = [];
    const revealProgress: number[] = ORBS.map(() =>
      reduceMotion.matches ? 1 : 0,
    );
    let orbRadius = 0;
    const meshes = ORBS.map((orb) => {
      const texture = createWorldOrbTexture({
        key: orb.key,
        category: orb.category,
        certainty: "fact",
      });
      if (texture) textures.push(texture);

      const geometry = new THREE.SphereGeometry(1, 52, 38);
      const material = createWorldOrbMaterial(
        { key: orb.key, category: orb.category, certainty: "fact" },
        texture,
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(0.08, -0.35, -0.03);
      material.opacity = reduceMotion.matches ? material.opacity : 0;
      scene.add(mesh);
      return { mesh, material, targetOpacity: 1 };
    });

    const applyRevealProgress = (index: number, progress: number) => {
      const eased = 1 - Math.pow(1 - progress, 3);
      const { mesh, material, targetOpacity } = meshes[index];
      mesh.scale.setScalar(orbRadius * (0.82 + eased * 0.18));
      material.opacity = targetOpacity * eased;
    };

    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);

      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();

      orbRadius = Math.min(88, Math.max(22, width / 16));
      const arcHeight = Math.min(46, Math.max(16, window.innerWidth * 0.032));
      meshes.forEach(({ mesh }, index) => {
        const offset = index - (ORBS.length - 1) / 2;
        mesh.position.set(
          offset * (width / ORBS.length),
          arcHeight * ARC_PROFILE[index],
          0,
        );
        applyRevealProgress(index, revealProgress[index]);
      });
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    let animationFrame = 0;
    let previousTime = performance.now();
    let revealStartTime: number | null = null;
    let revealCompleteNotified = false;
    let revealCompleteTimer = 0;
    let isStageVisible = false;

    const finishReveal = (delay = DESCRIPTION_DELAY_MS) => {
      if (revealCompleteNotified || revealCompleteTimer) return;

      const notifyComplete = () => {
        revealCompleteTimer = 0;
        revealCompleteNotified = true;
        onRevealComplete?.();
      };

      if (delay === 0) {
        notifyComplete();
        return;
      }

      revealCompleteTimer = window.setTimeout(notifyComplete, delay);
    };

    const beginReveal = () => {
      if (revealStartTime !== null) return;
      revealStartTime = performance.now();
      stage.dataset.revealing = "true";
    };

    const animate = (time: number) => {
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      let allRevealed = revealStartTime !== null;
      meshes.forEach(({ mesh }, index) => {
        mesh.rotation.y += elapsed * (0.085 + index * 0.007);

        if (revealStartTime !== null && !revealCompleteNotified) {
          const progress = Math.min(
            1,
            Math.max(
              0,
              (time - revealStartTime - index * ORB_STAGGER_MS) /
                ORB_REVEAL_MS,
            ),
          );
          revealProgress[index] = progress;
          applyRevealProgress(index, progress);
          if (progress < 1) allRevealed = false;
        }
      });
      if (allRevealed) finishReveal();
      renderer.render(scene, camera);
      animationFrame = isStageVisible
        ? window.requestAnimationFrame(animate)
        : 0;
    };

    const startAnimation = () => {
      if (animationFrame || !isStageVisible) return;
      previousTime = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    };

    let stageObserver: IntersectionObserver | null = null;

    if (reduceMotion.matches) {
      stage.dataset.revealing = "true";
      finishReveal(0);
    } else {
      stageObserver = new IntersectionObserver(
        ([entry]) => {
          isStageVisible = entry.isIntersecting;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            beginReveal();
          }

          if (isStageVisible) {
            startAnimation();
          } else {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
        },
        {
          root: stage.closest("main"),
          threshold: [0, 0.35],
        },
      );
      stageObserver.observe(stage);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(revealCompleteTimer);
      stageObserver?.disconnect();
      resizeObserver.disconnect();
      for (const { mesh } of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    };
  }, [onRevealComplete]);

  return (
    <div className={styles.row}>
      <div className={styles.stage} ref={stageRef}>
        <canvas
          className={styles.canvas}
          ref={canvasRef}
          aria-label="People, Place, Activity, Interest, Feeling, Condition and Pattern shown as Sidequest orbs"
        />
        <ul className={styles.labels} aria-hidden="true">
          {ORBS.map((orb, index) => (
            <li
              key={orb.key}
              style={{
                transitionDelay: `${index * ORB_STAGGER_MS + LABEL_DELAY_MS}ms`,
              }}
            >
              {orb.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
