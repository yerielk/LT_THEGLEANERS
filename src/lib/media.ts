export const MEDIA = ["FILM", "SERIES", "BOOK", "ALBUM", "EXHIBITION", "PERFORMANCE", "TRACK"] as const;
export type Medium = (typeof MEDIA)[number];
