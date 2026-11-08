/**
 * Wall colours for exhibition rooms, taken from Sanzo Wada's "A Dictionary of Color Combinations" (1933)
 * — names and hex values as published in the open dataset github.com/mattdesl/dictionary-of-colour-combinations.
 * Chosen for "vivid but calm" and spread around the hue wheel; the order keeps neighbouring room numbers far apart.
 */
export interface WallColour { name: string; hex: string; ink: string; key: string }

export const WALLS: WallColour[] = [
  { key: "lyons", name: "Deep Lyons Blue", hex: "#1c4286", ink: "#ffffff" },
  { key: "etruscan", name: "Etruscan Red", hex: "#c55347", ink: "#ffffff" },
  { key: "ocher", name: "Yellow Ocher", hex: "#e2b540", ink: "#1b1a17" },
  { key: "greenblue", name: "Green Blue", hex: "#099197", ink: "#ffffff" },
  { key: "oldrose", name: "Old Rose", hex: "#d46d7a", ink: "#ffffff" },
  { key: "oilgreen", name: "Oil Green", hex: "#819238", ink: "#ffffff" },
  { key: "blueviolet", name: "Blue Violet", hex: "#6450a1", ink: "#ffffff" },
  { key: "orangerufous", name: "Orange Rufous", hex: "#c16b27", ink: "#1b1a17" },
  { key: "redviolet", name: "Red Violet", hex: "#59256a", ink: "#ffffff" },
  { key: "nightgreen", name: "Night Green", hex: "#87c540", ink: "#1b1a17" },
  { key: "eupatorium", name: "Eupatorium Purple", hex: "#bf5892", ink: "#ffffff" },
  { key: "diaminegreen", name: "Diamine Green", hex: "#1a7444", ink: "#ffffff" },
];

export function wallFor(exhibitionNumber: number): WallColour {
  return WALLS[(Math.max(1, exhibitionNumber) - 1) % WALLS.length];
}
