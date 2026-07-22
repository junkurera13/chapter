import type { WorldNodeCategory } from "./graphData";

export type OrbPalette = readonly [string, string, string];

/**
 * Colour is categorical, never assigned per node. Texture, scale, and position
 * are free to vary while the material keeps teaching the same visual language.
 */
export const WORLD_CATEGORY_PALETTES: Record<WorldNodeCategory, OrbPalette> = {
  self: ["#ffffff", "#c7d9de", "#5f6677"],
  experience: ["#fff1e8", "#c7795f", "#442422"],
  people: ["#ffe9ed", "#c97687", "#603846"],
  place: ["#dff7f4", "#4d9997", "#173f48"],
  activity: ["#edf4de", "#7f9a65", "#304634"],
  interest: ["#e8edff", "#7889b5", "#343c65"],
  feeling: ["#f3eaff", "#9a7eb8", "#4b395d"],
  condition: ["#ededeb", "#84837e", "#292a29"],
  pattern: ["#f5f0df", "#aaa185", "#4d4b42"],
};

export function categoryPalette(category: WorldNodeCategory) {
  return WORLD_CATEGORY_PALETTES[category];
}

export function categoryOrbGradient(category: WorldNodeCategory) {
  const [light, mid, dark] = categoryPalette(category);
  return `radial-gradient(circle at 34% 24%, ${light}, ${mid} 48%, ${dark} 100%)`;
}
