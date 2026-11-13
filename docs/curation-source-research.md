# Curation source research

Checked 2026-11-14. This file holds editorial research separately from the curation manifest and database fields. Work IDs and metadata were matched against the local `lecta-catalog.csv`; every selected ID also exists in the existing `SEED_WORKS` catalog.

## `ex_blog_past_lives_longing`

- Source: [5 Films to Watch If You Loved Past Lives](https://guides.justwatch.com/uk/films-similar-to-past-lives) — JustWatch guide, published 2023-09-07 and updated 2026-04-24.
- Supported works: `w_film_past_lives`, `w_film_before_sunset`, `w_film_mood_for_love`, `w_film_cmbyn`.
- Basis: the guide recommends films for viewers moved by *Past Lives*, explicitly linking its selected films through longing, connection, time, and first love. The catalog matches are *Before Sunset*, *In the Mood for Love*, and *Call Me by Your Name*, alongside the guide's anchor film.

## `ex_blog_wong_kar_wai_hong_kong`

- Source: [10 essential modern directors from mainland China, Hong Kong and Taiwan](https://www.bfi.org.uk/lists/10-best-modern-directors-mainland-china-hong-kong-taiwan) — BFI editorial list.
- Supported works: `w_film_chungking`, `w_film_mood_for_love`.
- Basis: the BFI names both as essential Wong Kar-wai films and describes his Hong Kong work through melancholic romance and unfulfilled longing.

## `ex_blog_lee_chang_dong_slow_burn`

- Source: [Where to begin with Lee Chang-dong](https://www.bfi.org.uk/features/where-begin-with-lee-chang-dong) — BFI viewing guide, published 2026-10-12.
- Supported works: `w_film_burning`, `w_film_poetry`.
- Basis: the guide presents *Burning* as an entry point and *Poetry* as part of the next viewing path, connecting Lee's films through slow-burn drama, emotional intensity, and attention to people at society's margins.
- Tag evidence: `w_film_burning` → `longing` (0.65). The BFI guide describes the film's young characters through yearning and anxiety; this adds a controlled existing tag not already present on that work.

## `ex_blog_aftersun_drive_my_car_grief`

- Source: [FilmNight — Drive My Car (2021)](https://www.filmnight.com/reflections/drive-my-car/) — editorial reflection.
- Supported works: `w_film_aftersun`, `w_film_drive_my_car`.
- Basis: the article directly compares the two films through grief, revisiting memories, and questions left unasked after a loss.

## `ex_blog_perfect_days_paterson_everyday`

- Source: [Perfect Days](https://godalmingfilmsoc.org.uk/film-archive/2024-251/perfect-days/) — Godalming Film Society review.
- Supported works: `w_film_perfect_days`, `w_film_paterson`.
- Basis: the review identifies *Paterson* as the closest recent film in subject and tone to *Perfect Days*, whose focus is the quiet rhythm of an ordinary routine.

## `ex_blog_frank_ocean_blonde_channel_orange`

- Source: [Frank Ocean: Blonde review – a baffling and brilliant five-star triumph](https://www.theguardian.com/music/2016/aug/25/frank-ocean-blonde-review-a-baffling-and-brilliant-five-star-triumph) — The Guardian review, published 2016-08-25.
- Supported works: `w_album_blonde`, `w_album_channel_orange`.
- Basis: the review frames *Blonde* as a follow-up to *Channel Orange* and relates the pair through introspection, memory, intimacy, and exploratory sound.

## Tags

The manifest carries source-backed evidence for *Burning* → `longing`, *Bluets* → `longing`, *The Years* → `solitude`, *A Little Life* → `solitude`, *Everything Everywhere All at Once* → `love`, and *Inside Out* → `loss`. These use existing controlled tag keys; the seed inserts only missing work/tag pairs. No tag was inferred solely from sharing a curation. Source prose was summarized rather than copied, and no source text was used for embeddings.

## Additional source-backed curations

### `ex_blog_brief_encounters_city_nights`

- Source: [10 great films about brief encounters](https://www.bfi.org.uk/lists/10-great-films-about-brief-encounters) — BFI editorial list.
- Supported works: `w_film_before_sunset`, `w_film_mood_for_love`, `w_film_lost_translation`.
- Basis: the list groups brief, time-limited connections and discusses all three films through transient romance, memory, longing, and the intimacy of a chance meeting. **Evidence class: direct recommendation/list.**

### `ex_blog_mother_daughter_distance`

- Source: [10 great films about mothers and daughters](https://www.bfi.org.uk/lists/10-great-films-about-mothers-daughters) — BFI editorial list, 2025-07-03.
- Supported works: `w_film_lady_bird`, `w_film_eeaao`.
- Basis: the list directly includes both films and discusses the tense, loving, sometimes misunderstood mother-daughter bond in each. **Evidence class: direct recommendation/list.**

### `ex_blog_greta_gerwig_women`

- Source: [Where to begin with Greta Gerwig](https://www.bfi.org.uk/features/where-begin-with-greta-gerwig) — BFI viewing guide.
- Supported works: `w_film_lady_bird`, `w_film_little_women`.
- Basis: the guide places both films in Gerwig's body of work and links them through ambitious female characters, family tensions, and expectations around women's lives. **Evidence class: direct comparison/connection.**

### `ex_blog_memory_reassembled`

- Sources: [Top 10 books on memory](https://www.theguardian.com/books/2014/apr/02/top-10-books-memory-charles-fernyhough-pieces-of-light) and [Top 10 books about forgetting](https://www.theguardian.com/books/2015/sep/30/top-10-books-about-forgetting) — The Guardian editorial lists.
- Supported works: `w_book_austerlitz`, `w_book_sense_of_ending`.
- Basis: both lists explicitly include the two books in relation to autobiographical memory, reconstructed recollection, and the stories people tell about their past. **Evidence class: direct recommendation/list.**

### `ex_blog_grief_and_memory_across_media`

- Sources: [Inside Out: tales of ordinary sadness](https://www.bfi.org.uk/sight-and-sound/features/inside-out-tales-ordinary-sadness) — BFI/Sight and Sound; [Coco review](https://www.theguardian.com/film/2017/nov/21/coco-review-pixar-disney-mexico) — The Guardian; [Carrie & Lowell review](https://pitchfork.com/reviews/albums/20218-carrie-lowell/) — Pitchfork.
- Supported works: `w_film_coco`, `w_film_inside_out`, `w_album_carrie_lowell`.
- Basis: the BFI analysis connects *Inside Out* to nostalgia, sadness, and home; The Guardian describes *Coco* through grief and remembrance; Pitchfork directly discusses *Carrie & Lowell* as a personal work of bereavement and memory. Together they support a cross-media theme without relying on shared medium or genre. **Evidence class: synthesis across sources.**
- Tag evidence: `w_film_inside_out` → `loss` (0.60). BFI/Sight and Sound describes Riley's forced move from home and the change in how she remembers it.

### `ex_blog_solitude_on_the_page`

- Source: [Top 10 books about solitary living](https://www.theguardian.com/books/2023/aug/30/top-10-books-about-solitary-living-daniel-schreiber-alone) — The Guardian editorial list.
- Supported works: `w_book_bluets`, `w_book_little_life`, `w_book_the_years`.
- Basis: the list directly discusses *Bluets* through longing and solitude, *A Little Life* through lives shaped by aloneness and trauma, and *The Years* through social exclusion and solitary lives. **Evidence class: direct recommendation/list.**

### `ex_blog_stoner_remains_silence`

- Sources: [Revisiting the Classics: Stoner](https://www.nas.org/blogs/article/revisiting_the_classics_stoner/) — National Association of Scholars book review; [The Remains of the Day: a subtle masterpiece of quiet desperation](https://www.theguardian.com/books/booksblog/2016/jan/07/the-remains-of-the-day-by-kazuo-ishiguro-book-to-share) — The Guardian review.
- Supported works: `w_book_stoner`, `w_book_remains_of_day`.
- Basis: the NAS review directly compares both novels as portraits of men trapped within themselves; The Guardian describes Stevens's unspoken love and restrained life. **Evidence class: direct comparison/connection.**

### `ex_blog_miyazaki_shinkai_animation`

- Source: [From Genocidal Organ to Your Name: Japanese anime's new golden age](https://www.theguardian.com/film/2017/jun/30/japanese-anime-new-golden-age) — The Guardian film feature.
- Supported works: `w_film_spirited_away`, `w_film_your_name`.
- Basis: the feature places *Your Name* in direct comparison with *Spirited Away* as a new generation of Japanese animation rises, while distinguishing their approaches. The curation presents that contrast rather than assuming the films share a mood. **Evidence class: direct comparison/connection.**

## Coverage limit

The manifest now contains 14 distinct curation groupings (6 retained and 8 added), with 33 curation-to-work links and 29 unique work IDs. The 4,123-row CSV was used only as a local reference; every manifest work ID and its title, medium, and creator was checked against it. The 14-group result remains far below the requested ~300: the checked sources located in this pass support only a small number of distinct groupings among catalog works that are also present in the existing local seed catalog. I did not multiply the same works into near-duplicate sets or infer recommendations from unsupported co-occurrence. No database, seed, or `db:setup` command was run.
