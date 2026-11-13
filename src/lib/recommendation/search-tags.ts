import { extractTagsFromText, normalize, TAGS } from "./tags";

const RELATED_SEARCH_TAGS: Array<[string, string, number]> = [
  ["memory", "wistful", 0.65], ["memory", "vintage", 0.3], ["memory", "lingering_emotion", 0.4],
  ["longing", "love", 0.55], ["longing", "wistful", 0.55], ["longing", "loss", 0.35],
  ["love", "intimate", 0.4], ["love", "tender", 0.4], ["love", "desire", 0.45],
  ["solitude", "alienation", 0.55], ["solitude", "contemplative", 0.35], ["solitude", "minimal", 0.25],
  ["loss", "grief", 0.7], ["loss", "memory", 0.4], ["grief", "memory", 0.4], ["grief", "family", 0.3],
  ["identity", "growing_up", 0.4], ["identity", "alienation", 0.4], ["belonging", "family", 0.35],
  ["belonging", "migration", 0.5], ["friendship", "warm", 0.35], ["friendship", "tender", 0.3],
  ["time", "memory", 0.5], ["time", "wistful", 0.35], ["desire", "love", 0.5],
  ["everyday", "contemplative", 0.4], ["everyday", "warm", 0.3], ["history", "memory", 0.35],
  ["history", "migration", 0.35], ["migration", "belonging", 0.5], ["wistful", "longing", 0.5],
  ["melancholic", "grief", 0.4], ["melancholic", "loss", 0.45], ["melancholic", "solitude", 0.3],
  ["intimate", "tender", 0.45], ["dreamy", "atmosphere", 0.45], ["dreamy", "sonic_texture", 0.25],
  ["warm", "tender", 0.5], ["warm", "family", 0.3], ["unsettling", "ambiguity", 0.45],
  ["unsettling", "experimental", 0.25], ["contemplative", "minimal", 0.3], ["contemplative", "slow_burn", 0.4],
  ["playful", "friendship", 0.25], ["playful", "warm", 0.3], ["minimal", "restrained_expression", 0.3],
  ["lush", "sonic_texture", 0.3], ["lush", "atmosphere", 0.3], ["vintage", "wistful", 0.3],
  ["experimental", "poetic_prose", 0.25], ["naturalistic", "nuanced_characters", 0.35],
  ["naturalistic", "everyday", 0.25], ["restrained_expression", "intimate", 0.35],
  ["restrained_expression", "slow_burn", 0.35], ["lingering_emotion", "wistful", 0.4],
  ["nuanced_characters", "identity", 0.3], ["atmosphere", "sonic_texture", 0.3],
  ["ambiguity", "experimental", 0.3], ["slow_burn", "contemplative", 0.35],
];

function singularizeSearchToken(token: string): string {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) return token.slice(0, -1);
  return token;
}

function normalizedSearchQuery(query: string): string {
  return normalize(query).split(" ").filter(Boolean).map(singularizeSearchToken).join(" ");
}

function textSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

/** Resolves known synonyms and nearby vocabulary terms into weighted tag keys. */
export function queryTagWeights(query: string, minFuzzyScore = 0): Map<string, number> {
  const normalized = normalizedSearchQuery(query);
  const direct = new Map<string, number>();
  for (const match of [...extractTagsFromText(query), ...extractTagsFromText(normalized)]) direct.set(match.key, 1);

  if (!direct.size) {
    const tokens = normalized.split(" ").filter((token) => token.length >= 3);
    let closest: { key: string; score: number } | null = null;
    for (const tag of TAGS) {
      const phrases = [tag.key.replace(/_/g, " "), tag.ko, tag.en, ...tag.synonyms];
      const score = Math.max(0, ...phrases.flatMap((phrase) => normalize(phrase).split(" ").map((word) =>
        Math.max(0, ...tokens.map((token) => textSimilarity(token, singularizeSearchToken(word)))))));
      if (!closest || score > closest.score || (score === closest.score && tag.key < closest.key)) closest = { key: tag.key, score };
    }
    if (closest && closest.score > 0 && closest.score >= minFuzzyScore) direct.set(closest.key, 0.25 + closest.score * 0.5);
  }

  const related = new Map(direct);
  for (const [key, weight] of direct) {
    for (const [left, right, similarity] of RELATED_SEARCH_TAGS) {
      if (left === key) related.set(right, Math.max(related.get(right) ?? 0, weight * similarity));
      else if (right === key) related.set(left, Math.max(related.get(left) ?? 0, weight * similarity));
    }
  }
  return related;
}
