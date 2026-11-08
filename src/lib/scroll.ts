/**
 * How far a wheel event should move a sideways wall, or null when it belongs to the page.
 * Up/down always scrolls the page; only a sideways swipe or Shift+wheel walks the wall.
 */
export function sidewaysDelta(e: { deltaX: number; deltaY: number; shiftKey: boolean }): number | null {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return e.deltaX;
  // some browsers report Shift+wheel as deltaY
  if (e.shiftKey && e.deltaY !== 0) return e.deltaY;
  return null;
}
