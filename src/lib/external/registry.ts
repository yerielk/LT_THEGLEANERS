import { asLectaError } from "../services/errors";
import { createKakaoBook } from "./kakao-book";
import { createKopis } from "./kopis";
import { createMusicBrainz } from "./musicbrainz";
import { createSeoulCulture } from "./seoul-culture";
import { createTmdb } from "./tmdb";
import type { ExternalProvider, ExternalSearchParams, ExternalSource, ExternalWork } from "./types";

// one set per process: the MusicBrainz request queue only works if everyone shares it
const g = globalThis as { __lectaProviders?: ExternalProvider[] };

export function defaultProviders(): ExternalProvider[] {
  return (g.__lectaProviders ??= [createTmdb(), createKakaoBook(), createMusicBrainz(), createKopis(), createSeoulCulture()]);
}

export interface ExternalSearchResult {
  works: ExternalWork[];
  /** Sources that could not answer. The others' results are still returned. */
  failedSources: { source: ExternalSource; code: string; message: string }[];
}

/** Asks every provider that covers the medium, at once. One source failing does not fail the search. */
export async function searchExternal(params: ExternalSearchParams, providers: ExternalProvider[] = defaultProviders()): Promise<ExternalSearchResult> {
  const asked = providers.filter((p) => !params.medium || p.media.includes(params.medium));
  const settled = await Promise.allSettled(asked.map((p) => p.search(params)));
  const result: ExternalSearchResult = { works: [], failedSources: [] };
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") return result.works.push(...s.value);
    const err = asLectaError(s.reason);
    result.failedSources.push({ source: asked[i].source, code: err.code, message: err.message });
  });
  return result;
}
