"use client";
import { useCallback, useEffect, useState } from "react";
import type { CoverWork } from "@/components/WorkCover";

export type SelectedWork = CoverWork & { id: string };
const KEY = "lecta.selection.v1";
const EVT = "lecta-selection";

function read(): SelectedWork[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(v: SelectedWork[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: selection lives in memory only */ }
  window.dispatchEvent(new Event(EVT));
}

/** Selection shelf shared by Discover, Work detail and the Builder. Survives refresh within the tab (sessionStorage). */
export function useSelection() {
  const [items, setItems] = useState<SelectedWork[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    setReady(true);
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const add = useCallback((w: SelectedWork) => { const cur = read(); if (!cur.some((x) => x.id === w.id)) write([...cur, w]); }, []);
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);
  const toggle = useCallback((w: SelectedWork) => { const cur = read(); write(cur.some((x) => x.id === w.id) ? cur.filter((x) => x.id !== w.id) : [...cur, w]); }, []);
  const clear = useCallback(() => write([]), []);
  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);
  return { items, ready, add, remove, toggle, clear, has };
}
