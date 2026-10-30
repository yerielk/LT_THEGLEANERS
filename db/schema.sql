-- Lecta schema (SQLite). Written in portable SQL so it can move to Postgres/Supabase:
-- TEXT ids, ISO-8601 TEXT timestamps, CHECK constraints instead of SQLite-only enums.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  demo_flag     INTEGER NOT NULL DEFAULT 0,
  is_editorial  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id                   TEXT PRIMARY KEY,
  medium               TEXT NOT NULL CHECK (medium IN ('FILM','SERIES','BOOK','ALBUM')),
  title                TEXT NOT NULL,
  original_title       TEXT,
  creator              TEXT NOT NULL,
  release_year         INTEGER,
  synopsis             TEXT,
  artwork_url          TEXT,
  artwork_source       TEXT,
  artwork_license_note TEXT,
  external_source      TEXT,
  external_id          TEXT,
  source_url           TEXT,
  metadata_status      TEXT NOT NULL CHECK (metadata_status IN ('VERIFIED','CURATED','INCOMPLETE')),
  cover_tone           TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS works_external_uq ON works(external_source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS works_medium_idx ON works(medium);

CREATE TABLE IF NOT EXISTS work_tags (
  id            TEXT PRIMARY KEY,
  work_id       TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_key       TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('MOOD','THEME','AESTHETIC','NARRATIVE','PACE')),
  weight        REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
  provenance    TEXT NOT NULL CHECK (provenance IN ('HUMAN_CURATED','EXTERNAL','LLM_SUGGESTED')),
  evidence_text TEXT,
  reviewed      INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS work_tags_uq ON work_tags(work_id, tag_key);

CREATE TABLE IF NOT EXISTS exhibitions (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES users(id),
  slug            TEXT UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  visibility      TEXT NOT NULL CHECK (visibility IN ('DRAFT','PRIVATE','PUBLIC')),
  layout_template TEXT NOT NULL DEFAULT 'EDITORIAL_01',
  is_editorial    INTEGER NOT NULL DEFAULT 0,
  number          INTEGER NOT NULL,
  request_key     TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS exhibitions_request_uq ON exhibitions(owner_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS exhibitions_owner_idx ON exhibitions(owner_id);

CREATE TABLE IF NOT EXISTS exhibition_items (
  id             TEXT PRIMARY KEY,
  exhibition_id  TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  work_id        TEXT NOT NULL REFERENCES works(id),
  position       INTEGER NOT NULL,
  curator_note   TEXT,
  visual_variant TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS exhibition_items_uq ON exhibition_items(exhibition_id, work_id);
CREATE INDEX IF NOT EXISTS exhibition_items_pos_idx ON exhibition_items(exhibition_id, position);

CREATE TABLE IF NOT EXISTS taste_signals (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id),
  work_id               TEXT REFERENCES works(id),
  exhibition_id         TEXT REFERENCES exhibitions(id) ON DELETE CASCADE,
  signal_type           TEXT NOT NULL CHECK (signal_type IN ('SAVED','LIKED','DISLIKED','CURATED','RECOMMENDATION_ADDED')),
  why_text              TEXT,
  structured_tags_json  TEXT,
  origin                TEXT NOT NULL CHECK (origin IN ('USER_EXPLICIT','MODEL_SUGGESTED','CURATORIAL')),
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendation_events (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT,
  exhibition_id        TEXT,
  seed_work_ids_json   TEXT NOT NULL,
  candidate_work_id    TEXT NOT NULL,
  score                REAL NOT NULL,
  score_breakdown_json TEXT NOT NULL,
  model_version        TEXT NOT NULL,
  action               TEXT NOT NULL CHECK (action IN ('EXPOSED','CLICKED','ADDED','DISMISSED')),
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_activity (
  id                TEXT PRIMARY KEY,
  actor             TEXT NOT NULL,
  tool_name         TEXT NOT NULL,
  request_id        TEXT,
  target_type       TEXT,
  target_id         TEXT,
  status            TEXT NOT NULL,
  duration_ms       INTEGER,
  safe_summary_json TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_activity_created_idx ON agent_activity(created_at);
