/**
 * Lecta taste vocabulary. Internal keys are English snake_case; the UI shows the Korean label.
 * `synonyms` power the no-LLM path: free text (exhibition title, description, curator notes,
 * "why I liked it" lines) is matched against these phrases to produce tag keys.
 */
export type TagCategory = "MOOD" | "THEME" | "AESTHETIC" | "NARRATIVE" | "PACE";

export interface TagDef {
  key: string;
  category: TagCategory;
  ko: string;
  en: string;
  synonyms: string[];
}

export const TAGS: TagDef[] = [
  // THEME
  { key: "memory", category: "THEME", ko: "기억", en: "memory", synonyms: ["memory", "memories", "remember", "remembering", "recollection", "기억", "추억", "회상"] },
  { key: "longing", category: "THEME", ko: "그리움", en: "longing", synonyms: ["longing", "yearning", "miss", "missing", "unsaid", "그리움", "그리운", "갈망", "동경"] },
  { key: "love", category: "THEME", ko: "사랑", en: "love", synonyms: ["love", "romance", "romantic", "lovers", "사랑", "연애", "로맨스"] },
  { key: "solitude", category: "THEME", ko: "고독", en: "solitude", synonyms: ["solitude", "alone", "lonely", "loneliness", "quiet", "고독", "혼자", "외로움", "쓸쓸"] },
  { key: "loss", category: "THEME", ko: "상실", en: "loss", synonyms: ["loss", "lost", "absence", "left", "상실", "잃어버린", "부재", "이별"] },
  { key: "grief", category: "THEME", ko: "애도", en: "grief", synonyms: ["grief", "mourning", "death", "dying", "애도", "슬픔", "죽음"] },
  { key: "identity", category: "THEME", ko: "정체성", en: "identity", synonyms: ["identity", "self", "who we are", "becoming", "정체성", "자아", "나다움"] },
  { key: "belonging", category: "THEME", ko: "소속", en: "belonging", synonyms: ["belonging", "home", "homeland", "familiar", "places", "소속", "고향", "집", "익숙한"] },
  { key: "growing_up", category: "THEME", ko: "성장", en: "growing up", synonyms: ["growing up", "coming of age", "youth", "childhood", "adolescence", "성장", "청춘", "어린 시절", "유년"] },
  { key: "alienation", category: "THEME", ko: "소외", en: "alienation", synonyms: ["alienation", "stranger", "strangers", "estranged", "disconnection", "소외", "낯선", "이방인"] },
  { key: "family", category: "THEME", ko: "가족", en: "family", synonyms: ["family", "father", "mother", "parent", "daughter", "son", "가족", "아버지", "어머니", "부모"] },
  { key: "friendship", category: "THEME", ko: "우정", en: "friendship", synonyms: ["friendship", "friends", "neighbors", "우정", "친구", "이웃"] },
  { key: "time", category: "THEME", ko: "시간", en: "time", synonyms: ["time", "years", "passing", "last scene", "ending", "시간", "세월", "지나간"] },
  { key: "desire", category: "THEME", ko: "욕망", en: "desire", synonyms: ["desire", "passion", "욕망", "열정"] },
  { key: "everyday", category: "THEME", ko: "일상", en: "everyday life", synonyms: ["everyday", "daily", "ordinary", "routine", "일상", "평범한", "하루"] },
  { key: "history", category: "THEME", ko: "역사", en: "history", synonyms: ["history", "historical", "generations", "역사", "세대"] },
  { key: "migration", category: "THEME", ko: "이주", en: "migration", synonyms: ["migration", "immigrant", "diaspora", "abroad", "이주", "이민", "디아스포라"] },
  // MOOD
  { key: "wistful", category: "MOOD", ko: "아련한", en: "wistful", synonyms: ["wistful", "nostalgic", "nostalgia", "아련", "향수", "노스탤지어"] },
  { key: "melancholic", category: "MOOD", ko: "우울한", en: "melancholic", synonyms: ["melancholy", "melancholic", "sad", "blue", "우울", "멜랑콜리", "서글픈"] },
  { key: "intimate", category: "MOOD", ko: "내밀한", en: "intimate", synonyms: ["intimate", "close", "private", "내밀", "친밀", "사적인"] },
  { key: "dreamy", category: "MOOD", ko: "몽환적인", en: "dreamy", synonyms: ["dreamy", "dream", "hazy", "soft focus", "soft", "몽환", "꿈같은", "흐릿한"] },
  { key: "warm", category: "MOOD", ko: "따뜻한", en: "warm", synonyms: ["warm", "warmth", "comforting", "따뜻", "온기", "다정"] },
  { key: "unsettling", category: "MOOD", ko: "불안한", en: "unsettling", synonyms: ["unsettling", "uneasy", "tense", "eerie", "불안", "섬뜩", "긴장"] },
  { key: "contemplative", category: "MOOD", ko: "사색적인", en: "contemplative", synonyms: ["contemplative", "reflective", "meditative", "thoughtful", "사색", "명상적", "성찰"] },
  { key: "tender", category: "MOOD", ko: "다정한", en: "tender", synonyms: ["tender", "gentle", "tenderness", "부드러운", "섬세한"] },
  { key: "playful", category: "MOOD", ko: "경쾌한", en: "playful", synonyms: ["playful", "funny", "witty", "humor", "경쾌", "유머", "재치"] },
  // AESTHETIC
  { key: "minimal", category: "AESTHETIC", ko: "미니멀", en: "minimal", synonyms: ["minimal", "spare", "sparse", "bare", "미니멀", "절제된 화면", "간결"] },
  { key: "lush", category: "AESTHETIC", ko: "풍성한", en: "lush", synonyms: ["lush", "rich", "saturated", "lavish", "풍성", "화려"] },
  { key: "vintage", category: "AESTHETIC", ko: "빈티지", en: "vintage", synonyms: ["vintage", "retro", "period", "빈티지", "레트로", "시대극"] },
  { key: "experimental", category: "AESTHETIC", ko: "실험적인", en: "experimental", synonyms: ["experimental", "avant-garde", "fragmented", "실험적", "파편적"] },
  { key: "naturalistic", category: "AESTHETIC", ko: "자연주의적인", en: "naturalistic", synonyms: ["naturalistic", "realist", "realistic", "자연주의", "사실적"] },
  // NARRATIVE (the "why I liked it" layer)
  { key: "restrained_expression", category: "NARRATIVE", ko: "절제된 표현", en: "restrained expression", synonyms: ["restrained", "understated", "unsaid", "subtle", "quiet emotion", "절제", "말하지 않은", "담담", "대사가 적은"] },
  { key: "lingering_emotion", category: "NARRATIVE", ko: "오래 남는 여운", en: "lingering emotion", synonyms: ["lingering", "lingers", "stays", "haunting", "afterglow", "여운", "오래 남는", "잔상"] },
  { key: "nuanced_characters", category: "NARRATIVE", ko: "입체적인 인물", en: "nuanced characters", synonyms: ["nuanced characters", "characters", "complex characters", "입체적", "인물", "캐릭터"] },
  { key: "atmosphere", category: "NARRATIVE", ko: "분위기", en: "atmosphere", synonyms: ["atmosphere", "atmospheric", "mood", "분위기", "공기감"] },
  { key: "poetic_prose", category: "NARRATIVE", ko: "시적인 문장", en: "poetic prose", synonyms: ["poetic", "prose", "lyrical", "sentences", "시적", "문장", "서정"] },
  { key: "sonic_texture", category: "NARRATIVE", ko: "소리의 질감", en: "sonic texture", synonyms: ["sonic", "sound", "texture", "production", "soundtrack", "소리", "사운드", "음색"] },
  { key: "ambiguity", category: "NARRATIVE", ko: "해석의 여지", en: "ambiguity", synonyms: ["ambiguity", "ambiguous", "open ending", "mystery", "해석", "모호", "열린 결말"] },
  { key: "slow_burn", category: "PACE", ko: "느린 호흡", en: "slow burn", synonyms: ["slow", "slow burn", "patient", "unhurried", "느린", "호흡", "잔잔"] },
];

export const TAG_BY_KEY: Record<string, TagDef> = Object.fromEntries(TAGS.map((t) => [t.key, t]));

export function tagLabel(key: string): string {
  return TAG_BY_KEY[key]?.ko ?? key;
}

/** Normalize text for matching: lowercase, collapse whitespace and punctuation. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[_\-–—.,!?;:()"'“”‘’/]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface TextTagMatch {
  key: string;
  phrase: string;
}

/**
 * Dictionary/synonym extraction (no LLM). Returns each matched tag once with the phrase that matched.
 * English phrases match on word boundaries; Korean phrases match as substrings (agglutinative).
 */
export function extractTagsFromText(text: string | null | undefined): TextTagMatch[] {
  if (!text) return [];
  const norm = ` ${normalize(text)} `;
  const out: TextTagMatch[] = [];
  for (const tag of TAGS) {
    // direct key mention, e.g. "lingering_emotion"
    const candidates = [tag.key.replace(/_/g, " "), ...tag.synonyms];
    for (const raw of candidates) {
      const phrase = normalize(raw);
      if (!phrase) continue;
      const isHangul = /[가-힣]/.test(phrase);
      const hit = isHangul ? norm.includes(phrase) : norm.includes(` ${phrase} `);
      if (hit) {
        out.push({ key: tag.key, phrase: raw });
        break;
      }
    }
  }
  return out;
}

/** Accepts keys ("lingering_emotion") or free phrases ("understated dialogue") and returns tag keys. */
export function resolveReasons(reasons: string[] | undefined): TextTagMatch[] {
  if (!reasons?.length) return [];
  const seen = new Map<string, TextTagMatch>();
  for (const r of reasons) {
    if (TAG_BY_KEY[r]) {
      if (!seen.has(r)) seen.set(r, { key: r, phrase: r });
      continue;
    }
    for (const m of extractTagsFromText(r)) if (!seen.has(m.key)) seen.set(m.key, { key: m.key, phrase: r });
  }
  return [...seen.values()];
}
