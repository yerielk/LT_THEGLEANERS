/**
 * Wall colours for exhibition rooms, taken from Sanzo Wada's "A Dictionary of Color Combinations" (1933)
 * — names and hex values as published in the open dataset github.com/mattdesl/dictionary-of-colour-combinations.
 * Chosen for "vivid but calm": saturation 0.45–1.0, lightness 0.3–0.6.
 */
export interface WallColour { name: string; hex: string; ink: string; key: string }

export const WALLS: WallColour[] = [
  { key: "lyons", name: "Deep Lyons Blue", hex: "#1c4286", ink: "#ffffff" },
  { key: "etruscan", name: "Etruscan Red", hex: "#c55347", ink: "#ffffff" },
  { key: "ocher", name: "Yellow Ocher", hex: "#e2b540", ink: "#1b1a17" },
  { key: "greenblue", name: "Green Blue", hex: "#099197", ink: "#ffffff" },
  { key: "oldrose", name: "Old Rose", hex: "#d46d7a", ink: "#ffffff" },
  { key: "oilgreen", name: "Oil Green", hex: "#819238", ink: "#ffffff" },
];

export function wallFor(exhibitionNumber: number): WallColour {
  return WALLS[(Math.max(1, exhibitionNumber) - 1) % WALLS.length];
}
