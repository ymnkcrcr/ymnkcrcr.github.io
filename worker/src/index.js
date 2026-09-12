// ポートフォリオ 趣味データ API
//
// 現時点のエンドポイントは読み取り専用の 1 本のみ:
//   GET /api/games  … data/games.json とまったく同じ形の JSON を返す
//
// レスポンス形状を JSON ファイルに揃えてあるため、フロント側は fetch 先を
// 差し替えるだけで移行できる。

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

// GitHub Pages から別オリジンの Worker を呼ぶため CORS が必要。
// 許可するオリジンは明示列挙する（ワイルドカードにしない）。
const ALLOWED_ORIGINS = new Set([
  'https://ymnkcrcr.github.io',
  'http://localhost:8000',
  'http://localhost:8899',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  };
}

function json(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

/**
 * games セクションを data/games.json と同じ形に組み立てて返す。
 * 4 本のクエリを batch() でまとめ、D1 への往復を 1 回に抑えている。
 */
async function fetchGames(db) {
  const [metaRes, platformRes, seriesRes, titleRes] = await db.batch([
    db.prepare('SELECT title, description, hint FROM meta WHERE section = ?').bind('games'),
    db.prepare('SELECT id, label, icon FROM platforms ORDER BY sort_order'),
    db.prepare(
      `SELECT id, platform_id, emoji, name, genre, stars, badge_type, badge_label, note, deco
         FROM series ORDER BY sort_order`
    ),
    db.prepare(
      `SELECT id, series_id, title, year, played, stars
         FROM titles ORDER BY series_id, sort_order`
    ),
  ]);

  const meta = metaRes.results[0];
  if (!meta) throw new Error('meta 行が見つかりません（seed.sql が未投入の可能性）');

  // series_id ごとにタイトルをまとめる
  const titlesBySeries = new Map();
  for (const row of titleRes.results) {
    let list = titlesBySeries.get(row.series_id);
    if (!list) titlesBySeries.set(row.series_id, (list = []));
    list.push({
      id: row.id,
      title: row.title,
      year: row.year,
      played: row.played === 1, // INTEGER → boolean に戻す
      stars: row.stars,
    });
  }

  return {
    meta: { title: meta.title, description: meta.description, hint: meta.hint },
    platforms: platformRes.results,
    series: seriesRes.results.map((s) => ({
      id: s.id,
      platform: s.platform_id,
      emoji: s.emoji,
      name: s.name,
      genre: s.genre,
      stars: s.stars,
      badge: { type: s.badge_type, label: s.badge_label },
      note: s.note,
      deco: JSON.parse(s.deco),
      titles: titlesBySeries.get(s.id) ?? [],
    })),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    if (url.pathname === '/api/games') {
      if (request.method !== 'GET') {
        return json({ error: 'Method Not Allowed' }, {
          status: 405,
          headers: { ...cors, allow: 'GET, OPTIONS' },
        });
      }
      try {
        const data = await fetchGames(env.DB);
        return json(data, {
          headers: { ...cors, 'cache-control': 'public, max-age=60' },
        });
      } catch (err) {
        // 内部エラーの詳細はログにのみ出し、レスポンスには含めない
        console.error('GET /api/games に失敗:', err);
        return json({ error: 'Internal Server Error' }, { status: 500, headers: cors });
      }
    }

    return json({ error: 'Not Found' }, { status: 404, headers: cors });
  },
};
