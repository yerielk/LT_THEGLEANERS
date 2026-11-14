import type { ExhibitionView } from "../services/exhibitions";
import type { WorkView } from "../services/works";
import type { CurationDocument, CurationItem } from "./document";

export function curationWork(work: Pick<WorkView, "id" | "title" | "creator" | "medium"> & { releaseYear?: number | null; artwork?: { url: string } | null }): CurationItem {
  return {
    id: work.id, title: work.title.slice(0, 200), creator: work.creator.slice(0, 300), year: work.releaseYear == null ? "" : String(work.releaseYear), medium: work.medium.toLowerCase(),
    reason: "", note: "", layout: "", featured: false, scenes: [], palette: null,
    cover: work.artwork ? { src: work.artwork.url } : null,
  };
}

/** Catalog identity and item order stay authoritative, including additions made by MCP. */
export function curationView(ex: ExhibitionView): CurationDocument {
  const stored = ex.curationData;
  const byId = new Map(stored?.items.map((item) => [item.id, item]));
  return {
    title: ex.title, subtitle: stored?.subtitle ?? "", curator: stored?.curator ?? ex.ownerName.slice(0, 60),
    intro: stored?.intro ?? ex.description ?? "", template: stored?.template ?? "the-spread",
    accentIndex: stored?.accentIndex ?? null, heroId: ex.items[0]?.workId,
    items: ex.items.map(({ work, curatorNote }) => {
      const item = byId.get(work.id);
      return { ...curationWork(work), ...item, id: work.id, title: work.title.slice(0, 200), creator: work.creator.slice(0, 300), year: work.releaseYear == null ? "" : String(work.releaseYear), medium: work.medium.toLowerCase(),
        reason: curatorNote ?? "" };
    }),
  };
}
