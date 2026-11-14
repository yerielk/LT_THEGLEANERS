"use client";

import { SelectButton } from "@/components/SelectButton";
import { useRecommendationSelection } from "@/lib/recommendation/selection";
import type { SelectedWork } from "@/lib/selection";
import type { Medium as WorkMedium } from "@/lib/media";

type Medium = "CURATION" | WorkMedium;

export function WorkDetailSelection({ work, query, medium }: { work: SelectedWork; query: string; medium: Medium }) {
  const { add, remove } = useRecommendationSelection(query, medium);
  return <SelectButton work={work} className="btn" labels={["Add to selection", "In your selection"]} onAction={(wasSelected) => {
    if (wasSelected) remove(work.id);
    else {
      add(work);
      window.dispatchEvent(new CustomEvent("lecta-detail-recommendation-scroll", { detail: { workId: work.id } }));
    }
  }} />;
}
