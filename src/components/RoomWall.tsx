import type { ReactNode } from "react";

/** Exhibition introduction and works share a responsive, non-scrolling layout. */
export function RoomWall({ children }: { children: ReactNode }) {
  return <div className="gallery-track" aria-label="Exhibition wall">{children}</div>;
}
