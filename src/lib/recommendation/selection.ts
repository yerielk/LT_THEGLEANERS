"use client";

import { useCallback, useEffect, useState } from "react";
import type { SelectedWork } from "@/lib/selection";
import type { Medium as WorkMedium } from "@/lib/media";

type Medium = "CURATION" | WorkMedium;
type StoredSelection = { context: string; items: SelectedWork[] };

const KEY = "lecta.recommendation-selection.v1";
const EVENT = "lecta-recommendation-selection";

function contextKey(query: string, medium: Medium) {
  return JSON.stringify([query.trim(), medium]);
}

function read(): StoredSelection {
  try {
    const raw = sessionStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) as StoredSelection : null;
    return value && typeof value.context === "string" && Array.isArray(value.items)
      ? value
      : { context: "", items: [] };
  } catch {
    return { context: "", items: [] };
  }
}

function write(value: StoredSelection) {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Keep this tab's recommendation state in memory when storage is unavailable. */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Search-context selection is separate from the persistent exhibition selection shelf. */
export function useRecommendationSelection(query: string, medium: Medium) {
  const context = contextKey(query, medium);
  const [stored, setStored] = useState<StoredSelection>({ context: "", items: [] });

  useEffect(() => {
    const sync = () => setStored(read());
    const current = read();
    if (current.context !== context) {
      const next = { context, items: [] };
      write(next);
      setStored(next);
    }
    else setStored(current);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [context]);

  const changeContext = useCallback((nextQuery: string, nextMedium: Medium) => {
    const next = contextKey(nextQuery, nextMedium);
    const current = read();
    if (current.context !== next) write({ context: next, items: [] });
  }, []);

  const add = useCallback((work: SelectedWork) => {
    const current = read();
    const items = current.context === context ? current.items : [];
    write({ context, items: [...items.filter((item) => item.id !== work.id), work] });
  }, [context]);

  const remove = useCallback((id: string) => {
    const current = read();
    if (current.context === context) write({ context, items: current.items.filter((item) => item.id !== id) });
  }, [context]);

  const toggle = useCallback((work: SelectedWork) => {
    const current = read();
    const items = current.context === context ? current.items : [];
    write({ context, items: items.some((item) => item.id === work.id)
      ? items.filter((item) => item.id !== work.id)
      : [...items, work] });
  }, [context]);

  const items = stored.context === context ? stored.items : [];
  return { items, ready: stored.context === context, add, remove, toggle, changeContext };
}
