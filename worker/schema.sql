-- ============================================================
--  ポートフォリオ 趣味データ スキーマ（games セクション）
--  投入: npx wrangler d1 execute portfolio-db --file=schema.sql
--  ※ 既存テーブルを DROP してから作り直す（初期構築・作り直し用）
-- ============================================================

DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS platforms;
DROP TABLE IF EXISTS meta;

-- セクション見出し（タブの h2 / 説明文 / ヒント）
CREATE TABLE meta (
  section     TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  hint        TEXT
);

-- プラットフォーム（Nintendo / PlayStation / PC）
CREATE TABLE platforms (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  icon       TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- シリーズ（カード1枚に相当）
CREATE TABLE series (
  id          TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id),
  emoji       TEXT NOT NULL,
  name        TEXT NOT NULL,
  genre       TEXT NOT NULL,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 5),
  badge_type  TEXT NOT NULL CHECK (badge_type IN ('loved', 'clear', 'playing')),
  badge_label TEXT NOT NULL,
  note        TEXT NOT NULL,
  -- 装飾絵文字。配列のままJSON文字列として保持する
  deco        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
);

-- 個別タイトル（シリーズモーダルの1行に相当）
CREATE TABLE titles (
  id         TEXT PRIMARY KEY,
  series_id  TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  year       TEXT NOT NULL,
  -- SQLite に BOOLEAN 型はないため 0 / 1 で保持する
  played     INTEGER NOT NULL DEFAULT 0 CHECK (played IN (0, 1)),
  stars      INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  sort_order INTEGER NOT NULL
);

CREATE INDEX idx_series_platform ON series (platform_id, sort_order);
CREATE INDEX idx_titles_series   ON titles (series_id, sort_order);
