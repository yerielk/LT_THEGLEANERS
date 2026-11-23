import { wallFor } from "../design";

/**
 * The colour of a curation's cover comes from the works on it: their artwork colours are the chips,
 * and the wall is built from the chip that carries the most character. Three treatments (deep, mid, pale)
 * rotate by room number so neighbouring cards differ. Guard rails keep walls away from yellowish paper
 * tones and keep the ink readable.
 */
export interface Swatch { hex: string; weight: number }
export interface CoverTheme { hex: string; ink: string; chips: string[]; source: "covers" | "tone" | "room" }
type ThemeWork = { palette?: Swatch[] | null; coverTone?: string | null };

/** The typographic cover tones (globals.css .tone-*), used when a work has no sampled palette. */
const TONE_HEX: Record<string, string> = {
  sea: "#1c4286", rust: "#c55347", dusk: "#5b4a74", olive: "#819238", ember: "#d9653d", sun: "#e2b540", night: "#23262e", neon: "#099197",
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function toHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const valid = (hex: unknown): hex is string => typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex);

export function coverTheme(number: number, works: ThemeWork[]): CoverTheme {
  const room = wallFor(number);
  const pool: (Swatch & { sampled: boolean })[] = [];
  works.slice(0, 3).forEach((work, index) => {
    const lead = 1 - index * 0.2;
    const sampled = (work.palette ?? []).filter((s) => valid(s?.hex)).slice(0, 5);
    if (sampled.length) sampled.forEach((s) => pool.push({ hex: s.hex.toLowerCase(), weight: (s.weight || 0.1) * lead, sampled: true }));
    else if (work.coverTone && TONE_HEX[work.coverTone]) pool.push({ hex: TONE_HEX[work.coverTone], weight: 0.5 * lead, sampled: false });
  });
  if (!pool.length) return { hex: room.hex, ink: room.ink, chips: [], source: "room" };

  // chips: the covers' own colours, most present first, skipping near-duplicates
  const chips: string[] = [];
  for (const s of [...pool].sort((a, b) => b.weight - a.weight)) {
    const c = toHsl(s.hex);
    const twin = chips.some((hex) => { const o = toHsl(hex); return Math.abs(o.l - c.l) < 0.1 && (Math.min(o.s, c.s) < 0.12 ? Math.abs(o.s - c.s) < 0.12 : hueGap(o.h, c.h) < 22); });
    if (!twin) chips.push(s.hex);
    if (chips.length === 4) break;
  }

  // the wall starts from the swatch with the most character: present and colourful, not a highlight or a shadow
  const isYellowish = (h: number) => h >= 28 && h <= 88;
  const scored: { h: number; s: number; score: number }[] = [];
  for (const s of pool) {
    const c = toHsl(s.hex);
    const chroma = c.s * (1 - Math.abs(2 * c.l - 1));
    if (chroma < 0.08) continue;
    scored.push({ h: c.h, s: c.s, score: s.weight * (0.3 + chroma) * (c.l > 0.88 || c.l < 0.08 ? 0.4 : 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  let best = scored[0] ?? null;
  // a yellow lead would force a dark olive wall: when the covers also carry another real colour, use that instead
  if (best && isYellowish(best.h)) {
    const other = scored.find((c) => !isYellowish(c.h) && c.score >= best!.score * 0.4);
    if (other) best = other;
  }
  const source = pool.some((s) => s.sampled) ? "covers" : "tone";
  let hex: string;
  if (!best) {
    // black-and-white covers: graphite, or a cool pale grey
    hex = number % 2 ? "#23262e" : "#e4e7ec";
  } else {
    const yellowish = isYellowish(best.h);
    const warm = best.h >= 15 && best.h <= 100;
    const treatment = yellowish ? "deep" : (["deep", "mid", "pale"] as const)[number % 3];
    if (yellowish) hex = fromHsl(best.h, clamp(best.s, 0.2, 0.34), 0.21);
    else if (treatment === "deep") hex = fromHsl(best.h, clamp(best.s, 0.3, 0.62), 0.25);
    else if (treatment === "mid" || warm) hex = fromHsl(best.h, clamp(best.s, 0.28, 0.52), 0.4);
    else hex = fromHsl(best.h, clamp(best.s, 0.18, 0.3), 0.9);
  }
  // ink is whichever of white and near-black reads better; a mid-tone wall is deepened until white clears 4.5:1
  const ratio = (wall: string, ink: string) => { const [hi, lo] = [luminance(wall), luminance(ink)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  let ink = ratio(hex, "#ffffff") >= ratio(hex, "#14171c") ? "#ffffff" : "#14171c";
  if (ratio(hex, ink) < 4.6) {
    const c = toHsl(hex);
    let l = c.l;
    while (l > 0.1 && ratio(fromHsl(c.h, c.s, l), "#ffffff") < 4.6) l -= 0.02;
    hex = fromHsl(c.h, c.s, l);
    ink = "#ffffff";
  }
  return { hex, ink, chips, source };
}
