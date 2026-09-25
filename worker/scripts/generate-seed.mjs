#!/usr/bin/env node
// data/games.json から seed.sql を生成する。
//   使い方: node scripts/generate-seed.mjs
// JSON を手で SQL に書き写すとズレるので、常にこのスクリプトで生成すること。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'data', 'games.json');
const dest = join(here, '..', 'seed.sql');

/** SQL のシングルクォート文字列にエスケープする */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const data = JSON.parse(readFileSync(src, 'utf8'));
const lines = [
  '-- ⚠️ このファイルは scripts/generate-seed.mjs が生成します。直接編集しないこと。',
  `-- 生成元: data/games.json`,
  '',
  'DELETE FROM titles;',
  'DELETE FROM series;',
  'DELETE FROM platforms;',
  'DELETE FROM meta;',
  '',
];

const { meta, platforms, series } = data;

lines.push('INSERT INTO meta (section, title, description, hint) VALUES');
lines.push(`  ('games', ${q(meta.title)}, ${q(meta.description)}, ${q(meta.hint)});`);
lines.push('');

lines.push('INSERT INTO platforms (id, label, icon, sort_order) VALUES');
lines.push(
  platforms
    .map((p, i) => `  (${q(p.id)}, ${q(p.label)}, ${q(p.icon)}, ${i})`)
    .join(',\n') + ';'
);
lines.push('');

lines.push(
  'INSERT INTO series (id, platform_id, emoji, name, genre, stars, badge_type, badge_label, note, deco, sort_order) VALUES'
);
lines.push(
  series
    .map(
      (s, i) =>
        `  (${q(s.id)}, ${q(s.platform)}, ${q(s.emoji)}, ${q(s.name)}, ${q(s.genre)}, ` +
        `${s.stars}, ${q(s.badge.type)}, ${q(s.badge.label)}, ${q(s.note)}, ` +
        `${q(JSON.stringify(s.deco))}, ${i})`
    )
    .join(',\n') + ';'
);
lines.push('');

const titleRows = series.flatMap((s) =>
  s.titles.map(
    (t, i) =>
      `  (${q(t.id)}, ${q(s.id)}, ${q(t.title)}, ${q(t.year)}, ` +
      `${t.played ? 1 : 0}, ${t.stars}, ${i})`
  )
);
lines.push('INSERT INTO titles (id, series_id, title, year, played, stars, sort_order) VALUES');
lines.push(titleRows.join(',\n') + ';');
lines.push('');

writeFileSync(dest, lines.join('\n'), 'utf8');

console.log(`seed.sql を生成しました`);
console.log(`  platforms: ${platforms.length} 件`);
console.log(`  series:    ${series.length} 件`);
console.log(`  titles:    ${titleRows.length} 件`);
