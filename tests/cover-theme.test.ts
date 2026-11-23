import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { coverTheme, toHsl } from "../src/lib/curation/cover-theme";
import { paletteOf } from "../src/lib/curation/sample-palette";

const contrast = (a: string, b: string) => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("coverTheme", () => {
  it("takes the wall hue from the works' own colours", () => {
    const theme = coverTheme(3, [{ palette: [{ hex: "#1f4f9a", weight: 0.6 }, { hex: "#e8e2d8", weight: 0.3 }] }, { palette: [{ hex: "#274b8c", weight: 0.7 }] }]);
    expect(theme.source).toBe("covers");
    expect(Math.abs(toHsl(theme.hex).h - 218)).toBeLessThan(20);
    expect(theme.chips[0]).toBe("#1f4f9a");
    expect(theme.chips).toContain("#e8e2d8");
  });

  it("never makes a yellowish or cream wall, and keeps the ink readable, for any hue and room number", () => {
    for (let hue = 0; hue < 360; hue += 6) {
      for (const [s, l] of [[0.9, 0.5], [0.5, 0.75], [0.35, 0.3], [0.8, 0.9]]) {
        for (let number = 1; number <= 6; number++) {
          const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - c / 2;
          const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
          const hex = "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
          const theme = coverTheme(number, [{ palette: [{ hex, weight: 0.8 }] }]);
          const wall = toHsl(theme.hex);
          const yellowish = wall.h >= 20 && wall.h <= 95;
          expect(yellowish && wall.l > 0.5, `${hex} room ${number} gave ${theme.hex}`).toBe(false);
          expect(contrast(theme.hex, theme.ink), `${theme.hex} on ${theme.ink}`).toBeGreaterThan(4.5);
        }
      }
    }
  });

  it("falls back to the cover tone, then to the room colour", () => {
    expect(coverTheme(1, [{ coverTone: "sea" }]).source).toBe("tone");
    expect(coverTheme(1, [{}]).source).toBe("room");
    expect(coverTheme(2, [{ palette: [{ hex: "#111111", weight: 0.5 }, { hex: "#eeeeee", weight: 0.5 }] }]).hex).toMatch(/^#(23262e|e4e7ec)$/);
  });
});

describe("paletteOf", () => {
  it("samples the dominant colour of an image", async () => {
    const png = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#1f4f9a" } }).png().toBuffer();
    const palette = await paletteOf(png);
    expect(palette.length).toBeGreaterThan(0);
    expect(Math.abs(toHsl(palette[0].hex).h - 217)).toBeLessThan(12);
  });
});
