"use client";
import { useSelection, type SelectedWork } from "@/lib/selection";

export function SelectButton({ work, className = "select-toggle", labels }: { work: SelectedWork; className?: string; labels?: [string, string] }) {
  const { has, toggle, ready } = useSelection();
  const on = ready && has(work.id);
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => toggle(work)} aria-label={`${on ? "Remove" : "Add"} ${work.title} ${on ? "from" : "to"} selection`}>
      {labels ? (on ? labels[1] : labels[0]) : on ? "✓" : "+"}
    </button>
  );
}
