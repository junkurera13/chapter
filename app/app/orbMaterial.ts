import * as THREE from "three";

import { categoryPalette } from "./categoryAppearance";
import type { WorldNode } from "./graphData";

type OrbMaterialNode = Pick<WorldNode, "key" | "category" | "certainty">;

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorldOrbTexture(node: OrbMaterialNode) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [light, mid, dark] = categoryPalette(node.category);
  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, light);
  base.addColorStop(0.48, mid);
  base.addColorStop(1, dark);
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = seededRandom(node.key);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const grain = (random() - 0.5) * 17;
    image.data[index] = Math.max(0, Math.min(255, image.data[index] + grain));
    image.data[index + 1] = Math.max(
      0,
      Math.min(255, image.data[index + 1] + grain),
    );
    image.data[index + 2] = Math.max(
      0,
      Math.min(255, image.data[index + 2] + grain),
    );
  }
  context.putImageData(image, 0, 0);

  context.save();
  context.globalAlpha = node.certainty === "hypothesis" ? 0.2 : 0.12;
  context.strokeStyle = light;
  context.lineWidth = 2;
  for (let line = 0; line < 6; line += 1) {
    const y = 26 + line * 15 + random() * 8;
    context.beginPath();
    context.moveTo(-20, y);
    context.bezierCurveTo(70, y - 16, 170, y + 17, 280, y - 3);
    context.stroke();
  }
  context.restore();

  const glow = context.createRadialGradient(76, 24, 1, 76, 24, 66);
  glow.addColorStop(0, "rgba(255,255,255,0.72)");
  glow.addColorStop(0.28, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function createWorldOrbMaterial(
  node: OrbMaterialNode,
  texture: THREE.Texture | null,
) {
  const isSelf = node.category === "self";

  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: texture,
    roughness: isSelf ? 0.13 : node.category === "pattern" ? 0.34 : 0.2,
    metalness: isSelf ? 0.1 : node.category === "condition" ? 0.16 : 0.04,
    clearcoat: 1,
    clearcoatRoughness: isSelf ? 0.09 : 0.16,
    iridescence: isSelf
      ? 0.68
      : node.certainty === "hypothesis"
        ? 0.32
        : 0.12,
    iridescenceIOR: isSelf ? 1.4 : 1.3,
    emissive: isSelf ? 0x65788b : 0x000000,
    emissiveIntensity: isSelf ? 0.1 : 0,
    transparent: true,
    opacity: node.certainty === "hypothesis" ? 0.88 : 1,
  });
}
