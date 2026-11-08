/**
 * Lecta seed catalog — real works only.
 *
 * Title / creator / year are factual metadata entered by the team (metadataStatus = CURATED: not yet
 * cross-checked against an external API, so no external IDs or artwork URLs are stored).
 * Tags are the team's *curated interpretation* (provenance HUMAN_CURATED), not facts about the work.
 * No poster/cover art is bundled: the UI renders typographic covers and never imitates real artwork.
 */
export type Medium = "FILM" | "SERIES" | "BOOK" | "ALBUM";

export interface SeedWork {
  id: string;
  medium: Medium;
  title: string;
  originalTitle?: string;
  creator: string;
  year: number;
  synopsis: string;
  tags: string; // "key:weight,key:weight"
  tone: string; // cover palette key
}

export const SEED_WORKS: SeedWork[] = [
  // ───────── FILM ─────────
  { id: "w_film_aftersun", medium: "FILM", title: "Aftersun", creator: "Charlotte Wells", year: 2022, tone: "sea",
    synopsis: "A woman revisits a holiday she took with her young father, piecing him together from memory and home video.",
    tags: "memory:0.95,family:0.85,grief:0.6,wistful:0.9,restrained_expression:0.8,lingering_emotion:0.95,ambiguity:0.6" },
  { id: "w_film_mood_for_love", medium: "FILM", title: "In the Mood for Love", originalTitle: "花樣年華", creator: "Wong Kar-wai", year: 2000, tone: "rust",
    synopsis: "Two neighbours in 1962 Hong Kong discover their spouses' affair and slowly drift toward each other.",
    tags: "longing:0.95,love:0.8,restrained_expression:0.95,lush:0.85,vintage:0.8,melancholic:0.7,atmosphere:0.9,lingering_emotion:0.8" },
  { id: "w_film_past_lives", medium: "FILM", title: "Past Lives", creator: "Celine Song", year: 2023, tone: "dusk",
    synopsis: "Childhood friends separated when one family emigrates from Seoul meet again in New York decades later.",
    tags: "longing:0.9,migration:0.8,time:0.8,love:0.7,identity:0.6,restrained_expression:0.8,wistful:0.85,lingering_emotion:0.85" },
  { id: "w_film_lost_translation", medium: "FILM", title: "Lost in Translation", creator: "Sofia Coppola", year: 2003, tone: "neon",
    synopsis: "An ageing actor and a young woman, both adrift in a Tokyo hotel, form a brief and quiet bond.",
    tags: "alienation:0.85,solitude:0.85,friendship:0.6,dreamy:0.75,atmosphere:0.85,ambiguity:0.6,wistful:0.6" },
  { id: "w_film_paterson", medium: "FILM", title: "Paterson", creator: "Jim Jarmusch", year: 2016, tone: "olive",
    synopsis: "A week in the life of a bus driver who writes poems in his notebook between routes.",
    tags: "everyday:0.95,contemplative:0.85,poetic_prose:0.7,minimal:0.75,warm:0.65,slow_burn:0.8,tender:0.6" },
  { id: "w_film_burning", medium: "FILM", title: "Burning", originalTitle: "버닝", creator: "Lee Chang-dong", year: 2018, tone: "ember",
    synopsis: "A young delivery worker becomes fixated on a woman from his hometown and the wealthy man she returns with.",
    tags: "alienation:0.8,desire:0.65,unsettling:0.9,ambiguity:0.95,slow_burn:0.85,atmosphere:0.75" },
  { id: "w_film_portrait", medium: "FILM", title: "Portrait of a Lady on Fire", originalTitle: "Portrait de la jeune fille en feu", creator: "Céline Sciamma", year: 2019, tone: "ember",
    synopsis: "On an island in 18th-century Brittany, a painter is commissioned to secretly paint a reluctant bride.",
    tags: "love:0.9,memory:0.7,desire:0.7,restrained_expression:0.8,lingering_emotion:0.9,intimate:0.85,slow_burn:0.7" },
  { id: "w_film_perfect_days", medium: "FILM", title: "Perfect Days", creator: "Wim Wenders", year: 2023, tone: "olive",
    synopsis: "A Tokyo public-toilet cleaner moves through a carefully kept routine of work, books, music and trees.",
    tags: "everyday:0.95,solitude:0.7,contemplative:0.9,warm:0.6,minimal:0.75,sonic_texture:0.5,restrained_expression:0.7" },
  { id: "w_film_cmbyn", medium: "FILM", title: "Call Me by Your Name", creator: "Luca Guadagnino", year: 2017, tone: "sun",
    synopsis: "A seventeen-year-old in 1980s northern Italy falls for the graduate student staying with his family.",
    tags: "love:0.9,desire:0.8,growing_up:0.8,lush:0.7,intimate:0.8,lingering_emotion:0.8,wistful:0.65" },
  { id: "w_film_moonlight", medium: "FILM", title: "Moonlight", creator: "Barry Jenkins", year: 2016, tone: "night",
    synopsis: "Three chapters in the life of a young man in Miami as he grows up and comes to terms with himself.",
    tags: "identity:0.95,growing_up:0.9,love:0.6,intimate:0.8,restrained_expression:0.8,lush:0.6,tender:0.75" },
  { id: "w_film_drive_my_car", medium: "FILM", title: "Drive My Car", creator: "Ryusuke Hamaguchi", year: 2021, tone: "rust",
    synopsis: "A grieving stage director and his young driver gradually open up during long rides to rehearsal.",
    tags: "grief:0.9,loss:0.85,restrained_expression:0.85,contemplative:0.8,slow_burn:0.85,nuanced_characters:0.85,lingering_emotion:0.75" },
  { id: "w_film_worst_person", medium: "FILM", title: "The Worst Person in the World", originalTitle: "Verdens verste menneske", creator: "Joachim Trier", year: 2021, tone: "dusk",
    synopsis: "Four years in the life of a woman in Oslo as she navigates love, work and who she wants to be.",
    tags: "identity:0.85,love:0.75,growing_up:0.7,playful:0.5,nuanced_characters:0.85,time:0.6,wistful:0.5" },

  // ───────── SERIES ─────────
  { id: "w_series_my_mister", medium: "SERIES", title: "My Mister", originalTitle: "나의 아저씨", creator: "Park Hae-young (writer), Kim Won-seok (director)", year: 2018, tone: "night",
    synopsis: "A worn-down engineer and a young temp worker carrying heavy debts slowly become each other's support.",
    tags: "solitude:0.8,friendship:0.75,family:0.6,warm:0.7,melancholic:0.75,nuanced_characters:0.95,lingering_emotion:0.9,restrained_expression:0.7" },
  { id: "w_series_normal_people", medium: "SERIES", title: "Normal People", creator: "Lenny Abrahamson, Hettie Macdonald (directors)", year: 2020, tone: "sea",
    synopsis: "Adaptation following two classmates from a small Irish town through years of an on-and-off relationship.",
    tags: "love:0.9,growing_up:0.8,intimate:0.9,nuanced_characters:0.85,restrained_expression:0.7,melancholic:0.6" },
  { id: "w_series_fleabag", medium: "SERIES", title: "Fleabag", creator: "Phoebe Waller-Bridge", year: 2016, tone: "ember",
    synopsis: "A sharp, grieving woman in London talks directly to the camera as her life and family come apart.",
    tags: "grief:0.7,family:0.7,identity:0.6,playful:0.9,nuanced_characters:0.85,intimate:0.6" },
  { id: "w_series_reply_1988", medium: "SERIES", title: "Reply 1988", originalTitle: "응답하라 1988", creator: "Shin Won-ho (director)", year: 2015, tone: "sun",
    synopsis: "Five families on one Seoul alley share meals, friendships and first loves in the late 1980s.",
    tags: "friendship:0.9,family:0.9,growing_up:0.8,memory:0.7,warm:0.95,vintage:0.75,wistful:0.7" },
  { id: "w_series_mad_men", medium: "SERIES", title: "Mad Men", creator: "Matthew Weiner", year: 2007, tone: "olive",
    synopsis: "An advertising creative director in 1960s New York hides a past while the decade changes around him.",
    tags: "identity:0.9,alienation:0.7,desire:0.6,vintage:0.9,nuanced_characters:0.9,slow_burn:0.7,restrained_expression:0.6" },
  { id: "w_series_twin_peaks", medium: "SERIES", title: "Twin Peaks", creator: "David Lynch, Mark Frost", year: 1990, tone: "night",
    synopsis: "An FBI agent investigates the murder of a homecoming queen in a small logging town full of secrets.",
    tags: "unsettling:0.9,dreamy:0.8,ambiguity:0.9,atmosphere:0.9,experimental:0.7,sonic_texture:0.6" },
  { id: "w_series_atlanta", medium: "SERIES", title: "Atlanta", creator: "Donald Glover", year: 2016, tone: "neon",
    synopsis: "A young man tries to manage his cousin's rising rap career while getting by in Atlanta.",
    tags: "identity:0.8,alienation:0.6,playful:0.8,experimental:0.75,unsettling:0.5,everyday:0.6" },
  { id: "w_series_leftovers", medium: "SERIES", title: "The Leftovers", creator: "Damon Lindelof, Tom Perrotta", year: 2014, tone: "dusk",
    synopsis: "Three years after two percent of the world's population vanished, a small town tries to live with the loss.",
    tags: "grief:0.95,loss:0.9,ambiguity:0.85,melancholic:0.8,family:0.6,lingering_emotion:0.8" },
  { id: "w_series_pachinko", medium: "SERIES", title: "Pachinko", creator: "Soo Hugh", year: 2022, tone: "rust",
    synopsis: "Adaptation following a Korean family across generations, from Busan to Osaka and New York.",
    tags: "migration:0.95,family:0.9,history:0.9,belonging:0.8,lush:0.6,lingering_emotion:0.6" },
  { id: "w_series_severance", medium: "SERIES", title: "Severance", creator: "Dan Erickson", year: 2022, tone: "neon",
    synopsis: "Office workers have their memories surgically split between work and home selves.",
    tags: "identity:0.9,memory:0.75,alienation:0.85,unsettling:0.85,minimal:0.7,ambiguity:0.6" },

  // ───────── BOOK ─────────
  { id: "w_book_never_let_me_go", medium: "BOOK", title: "Never Let Me Go", creator: "Kazuo Ishiguro", year: 2005, tone: "sea",
    synopsis: "Kathy looks back on her childhood at an English boarding school and the friends she grew up with.",
    tags: "memory:0.9,loss:0.85,friendship:0.75,growing_up:0.7,restrained_expression:0.9,melancholic:0.8,lingering_emotion:0.9" },
  { id: "w_book_remains_of_day", medium: "BOOK", title: "The Remains of the Day", creator: "Kazuo Ishiguro", year: 1989, tone: "olive",
    synopsis: "An English butler on a motoring trip reflects on decades of service and a love he never spoke of.",
    tags: "longing:0.9,memory:0.85,time:0.75,restrained_expression:0.95,lingering_emotion:0.85,wistful:0.8" },
  { id: "w_book_norwegian_wood", medium: "BOOK", title: "Norwegian Wood", originalTitle: "ノルウェイの森", creator: "Haruki Murakami", year: 1987, tone: "olive",
    synopsis: "A man remembers his student years in late-1960s Tokyo and two very different young women.",
    tags: "memory:0.9,loss:0.85,love:0.75,growing_up:0.7,melancholic:0.85,wistful:0.85" },
  { id: "w_book_normal_people", medium: "BOOK", title: "Normal People", creator: "Sally Rooney", year: 2018, tone: "sea",
    synopsis: "Connell and Marianne circle each other from school in the west of Ireland to university in Dublin.",
    tags: "love:0.9,growing_up:0.8,identity:0.6,intimate:0.85,nuanced_characters:0.9,restrained_expression:0.6" },
  { id: "w_book_vegetarian", medium: "BOOK", title: "The Vegetarian", originalTitle: "채식주의자", creator: "Han Kang", year: 2007, tone: "ember",
    synopsis: "After a dream, a woman in Seoul stops eating meat, and her family's reaction turns violent.",
    tags: "identity:0.85,alienation:0.85,desire:0.5,unsettling:0.9,poetic_prose:0.75,ambiguity:0.7" },
  { id: "w_book_human_acts", medium: "BOOK", title: "Human Acts", originalTitle: "소년이 온다", creator: "Han Kang", year: 2014, tone: "night",
    synopsis: "Interlinked voices circle the death of a boy during the 1980 Gwangju Uprising and its long aftermath.",
    tags: "grief:0.95,history:0.9,loss:0.85,memory:0.75,poetic_prose:0.8,lingering_emotion:0.9" },
  { id: "w_book_bluets", medium: "BOOK", title: "Bluets", creator: "Maggie Nelson", year: 2009, tone: "sea",
    synopsis: "Numbered prose fragments about the colour blue, heartbreak and grief.",
    tags: "love:0.7,loss:0.75,melancholic:0.85,experimental:0.75,poetic_prose:0.9,intimate:0.8" },
  { id: "w_book_giovannis_room", medium: "BOOK", title: "Giovanni's Room", creator: "James Baldwin", year: 1956, tone: "dusk",
    synopsis: "An American in Paris recalls his affair with an Italian bartender and the choices he made after.",
    tags: "love:0.85,desire:0.8,identity:0.85,longing:0.7,melancholic:0.75,poetic_prose:0.7" },
  { id: "w_book_stoner", medium: "BOOK", title: "Stoner", creator: "John Williams", year: 1965, tone: "olive",
    synopsis: "The quiet life of a farm boy who becomes an English professor at a Missouri university.",
    tags: "solitude:0.8,everyday:0.7,time:0.75,restrained_expression:0.9,contemplative:0.8,lingering_emotion:0.8,melancholic:0.6" },
  { id: "w_book_the_years", medium: "BOOK", title: "The Years", originalTitle: "Les Années", creator: "Annie Ernaux", year: 2008, tone: "rust",
    synopsis: "A collective memoir tracing one woman's life and French society from the 1940s to the 2000s.",
    tags: "memory:0.95,time:0.9,history:0.7,identity:0.6,experimental:0.6,contemplative:0.7" },
  { id: "w_book_kitchen", medium: "BOOK", title: "Kitchen", originalTitle: "キッチン", creator: "Banana Yoshimoto", year: 1988, tone: "sun",
    synopsis: "After her grandmother dies, a young woman in Tokyo finds comfort in kitchens and an unusual new family.",
    tags: "grief:0.8,family:0.7,solitude:0.6,warm:0.8,tender:0.8,dreamy:0.5" },
  { id: "w_book_pachinko", medium: "BOOK", title: "Pachinko", creator: "Min Jin Lee", year: 2017, tone: "rust",
    synopsis: "Four generations of a Korean family make a life in Japan across the twentieth century.",
    tags: "migration:0.95,family:0.9,history:0.9,belonging:0.85,nuanced_characters:0.7" },

  // ───────── ALBUM ─────────
  { id: "w_album_blonde", medium: "ALBUM", title: "Blonde", creator: "Frank Ocean", year: 2016, tone: "sun",
    synopsis: "Frank Ocean's second studio album.",
    tags: "memory:0.75,love:0.7,identity:0.6,dreamy:0.8,sonic_texture:0.85,intimate:0.75,lingering_emotion:0.75" },
  { id: "w_album_carrie_lowell", medium: "ALBUM", title: "Carrie & Lowell", creator: "Sufjan Stevens", year: 2015, tone: "sea",
    synopsis: "Sufjan Stevens' seventh studio album, written after the death of his mother.",
    tags: "grief:0.95,family:0.85,memory:0.8,minimal:0.8,intimate:0.9,restrained_expression:0.75,lingering_emotion:0.85" },
  { id: "w_album_for_emma", medium: "ALBUM", title: "For Emma, Forever Ago", creator: "Bon Iver", year: 2007, tone: "night",
    synopsis: "Bon Iver's debut album.",
    tags: "solitude:0.9,loss:0.75,longing:0.7,minimal:0.75,melancholic:0.75,sonic_texture:0.75" },
  { id: "w_album_punisher", medium: "ALBUM", title: "Punisher", creator: "Phoebe Bridgers", year: 2020, tone: "dusk",
    synopsis: "Phoebe Bridgers' second studio album.",
    tags: "alienation:0.7,loss:0.65,melancholic:0.85,intimate:0.75,playful:0.35,lingering_emotion:0.7" },
  { id: "w_album_blue", medium: "ALBUM", title: "Blue", creator: "Joni Mitchell", year: 1971, tone: "sea",
    synopsis: "Joni Mitchell's fourth studio album.",
    tags: "love:0.85,longing:0.8,intimate:0.9,melancholic:0.7,restrained_expression:0.5,poetic_prose:0.7" },
  { id: "w_album_pink_moon", medium: "ALBUM", title: "Pink Moon", creator: "Nick Drake", year: 1972, tone: "dusk",
    synopsis: "Nick Drake's third studio album.",
    tags: "solitude:0.9,melancholic:0.85,minimal:0.9,contemplative:0.7,lingering_emotion:0.7" },
  { id: "w_album_in_rainbows", medium: "ALBUM", title: "In Rainbows", creator: "Radiohead", year: 2007, tone: "ember",
    synopsis: "Radiohead's seventh studio album.",
    tags: "desire:0.6,love:0.55,intimate:0.7,lush:0.65,sonic_texture:0.9,melancholic:0.55" },
  { id: "w_album_titanic_rising", medium: "ALBUM", title: "Titanic Rising", creator: "Weyes Blood", year: 2019, tone: "sea",
    synopsis: "Weyes Blood's fourth studio album.",
    tags: "longing:0.75,dreamy:0.85,lush:0.85,vintage:0.6,wistful:0.75,sonic_texture:0.7" },
  { id: "w_album_kid_a", medium: "ALBUM", title: "Kid A", creator: "Radiohead", year: 2000, tone: "night",
    synopsis: "Radiohead's fourth studio album.",
    tags: "alienation:0.9,unsettling:0.75,experimental:0.9,sonic_texture:0.95,ambiguity:0.6" },
  { id: "w_album_hyukoh_23", medium: "ALBUM", title: "23", creator: "HYUKOH", year: 2017, tone: "olive",
    synopsis: "HYUKOH's first full-length album.",
    tags: "growing_up:0.85,alienation:0.6,identity:0.6,melancholic:0.6,sonic_texture:0.6,wistful:0.6" },
  { id: "w_album_async", medium: "ALBUM", title: "async", creator: "Ryuichi Sakamoto", year: 2017, tone: "olive",
    synopsis: "Ryuichi Sakamoto's studio album released in 2017.",
    tags: "grief:0.6,time:0.7,contemplative:0.9,experimental:0.75,minimal:0.75,sonic_texture:0.95,atmosphere:0.8" },
  { id: "w_album_teen_dream", medium: "ALBUM", title: "Teen Dream", creator: "Beach House", year: 2010, tone: "dusk",
    synopsis: "Beach House's third studio album.",
    tags: "love:0.65,longing:0.7,dreamy:0.95,lush:0.75,wistful:0.7,sonic_texture:0.8" },
];

export interface SeedExhibition {
  id: string;
  number: number;
  title: string;
  description: string;
  items: { workId: string; note?: string }[];
}

/** Editorial samples written by THE GLEANERS team — labelled "Editorial sample" in the UI. */
export const SEED_EXHIBITIONS: SeedExhibition[] = [
  {
    id: "ex_on_things_left_unsaid", number: 1, title: "On Things Left Unsaid",
    description: "A selection about restrained emotion and longing — feelings that stay because nobody names them.",
    items: [
      { workId: "w_film_mood_for_love", note: "Every corridor scene is a sentence left unfinished." },
      { workId: "w_book_remains_of_day", note: "A whole life of love, told by someone who refuses to say it." },
      { workId: "w_album_blue" },
      { workId: "w_film_drive_my_car" },
    ],
  },
  {
    id: "ex_after_the_last_scene", number: 2, title: "After the Last Scene",
    description: "Works about memory and the people we lose, and what lingers once the story ends.",
    items: [
      { workId: "w_film_aftersun", note: "The final dance stays long after the credits." },
      { workId: "w_album_carrie_lowell" },
      { workId: "w_book_the_years" },
      { workId: "w_album_pink_moon" },
    ],
  },
  {
    id: "ex_soft_focus", number: 3, title: "Soft Focus",
    description: "Dreamy, quiet companions for solitary evenings in unfamiliar cities.",
    items: [
      { workId: "w_film_lost_translation", note: "Being lonely together, softly." },
      { workId: "w_book_kitchen" },
      { workId: "w_album_teen_dream" },
      { workId: "w_film_perfect_days" },
    ],
  },
  {
    id: "ex_strangers_familiar_places", number: 4, title: "Strangers & Familiar Places",
    description: "On migration, belonging and the homes we carry with us across languages and generations.",
    items: [
      { workId: "w_film_past_lives", note: "In-yun: the idea that two lives have touched before." },
      { workId: "w_book_pachinko" },
      { workId: "w_album_hyukoh_23" },
      { workId: "w_series_reply_1988" },
    ],
  },
];

export const EDITORIAL_USER = { id: "u_editorial", handle: "thegleaners", displayName: "THE GLEANERS editorial" };
export const DEMO_USER = { id: "u_demo", handle: "demo", displayName: "Demo Workspace" };
