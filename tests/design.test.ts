import { describe, it, expect } from "vitest";
import { sidewaysDelta } from "../src/lib/scroll";
import { WALLS, wallFor } from "../src/lib/design";

describe("wheel on a sideways wall", () => {
  it("leaves a vertical wheel to the page", () => {
    expect(sidewaysDelta({ deltaX: 0, deltaY: 120, shiftKey: false })).toBeNull();
    expect(sidewaysDelta({ deltaX: 3, deltaY: -40, shiftKey: false })).toBeNull();
  });

  it("walks the wall on a sideways swipe or Shift+wheel", () => {
    expect(sidewaysDelta({ deltaX: 60, deltaY: 4, shiftKey: false })).toBe(60);
    expect(sidewaysDelta({ deltaX: -30, deltaY: 0, shiftKey: false })).toBe(-30);
    expect(sidewaysDelta({ deltaX: 0, deltaY: 100, shiftKey: true })).toBe(100);
    expect(sidewaysDelta({ deltaX: 100, deltaY: 0, shiftKey: true })).toBe(100);
  });
});

// CIE76 colour difference, enough to tell whether two walls read as different rooms
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe("room walls", () => {
  it("keeps the first rooms' colours", () => {
    expect([1, 2, 3, 4].map((n) => wallFor(n).key)).toEqual(["lyons", "etruscan", "ocher", "greenblue"]);
  });

  it("gives every wall its own colour", () => {
    expect(new Set(WALLS.map((w) => w.hex)).size).toBe(WALLS.length);
    for (let i = 0; i < WALLS.length; i++) for (let j = i + 1; j < WALLS.length; j++) expect(deltaE(WALLS[i].hex, WALLS[j].hex)).toBeGreaterThan(15);
  });

  it("never hangs similar walls on neighbouring room numbers", () => {
    for (let n = 1; n <= WALLS.length; n++) expect(deltaE(wallFor(n).hex, wallFor(n + 1).hex)).toBeGreaterThan(40);
  });
});
