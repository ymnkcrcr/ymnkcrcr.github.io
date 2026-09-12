# portfolio-api (Cloudflare Workers + D1)

趣味データを D1 から配信する API。現時点では**読み取り専用の 1 エンドポイントのみ**。

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/games` | `data/games.json` と同一形状の JSON を返す |

レスポンス形状を JSON ファイルに合わせてあるため、フロントは fetch 先の URL を
差し替えるだけで移行できる（現時点では未接続。`data/games.json` を見たまま）。

## 構成

```
worker/
├── wrangler.toml            Worker と D1 バインディングの設定
├── schema.sql               テーブル定義（DROP → CREATE）
├── seed.sql                 初期データ（自動生成・直接編集しない）
├── scripts/
│   └── generate-seed.mjs    data/games.json → seed.sql の生成
└── src/
    └── index.js             Worker 本体
```

### テーブル

| テーブル | 内容 |
|---|---|
| `meta` | セクション見出し（h2 / 説明 / ヒント） |
| `platforms` | Nintendo / PlayStation / PC |
| `series` | カード1枚に相当（17件） |
| `titles` | シリーズ内の個別タイトル（145件） |

`played` は SQLite に BOOLEAN がないため `0` / `1`、`deco` は絵文字配列を
JSON 文字列として保持し、Worker 側で `JSON.parse` して返している。

## ローカル開発

実 Cloudflare アカウントなしで動く。`--local` がローカル SQLite を使う。

```bash
cd worker

# データ再生成（data/games.json を編集したら必ず実行）
node scripts/generate-seed.mjs

# ローカル D1 にスキーマとデータを投入
npx wrangler d1 execute portfolio-db --local --file=schema.sql
npx wrangler d1 execute portfolio-db --local --file=seed.sql

# 起動 → http://localhost:8787/api/games
npx wrangler dev --local
```

`.wrangler/` にローカル DB の実体が作られる（git 管理外）。

## 本番へのデプロイ

初回のみ 1〜4 を実施し、以降は 5 のみ。

```bash
cd worker

# 1. Cloudflare にログイン（ブラウザが開く）
npx wrangler login

# 2. D1 データベースを作成
npx wrangler d1 create portfolio-db
#    → 出力された database_id を wrangler.toml の
#      PLACEHOLDER_RUN_WRANGLER_D1_CREATE と差し替える

# 3. 本番 D1 にスキーマを投入（--remote が本番、省略するとローカル）
npx wrangler d1 execute portfolio-db --remote --file=schema.sql

# 4. 初期データを投入
npx wrangler d1 execute portfolio-db --remote --file=seed.sql

# 5. デプロイ → https://portfolio-api.<サブドメイン>.workers.dev/api/games
npx wrangler deploy
```

> `schema.sql` は先頭で `DROP TABLE` するため、**本番に対して 3 を再実行すると
> 既存データが消える**。テーブル作成済みの環境で再投入するのは避けること。

## データ更新

現状は D1 が正ではなく `data/games.json` が正。JSON を編集したあと、

```bash
node scripts/generate-seed.mjs
npx wrangler d1 execute portfolio-db --remote --file=seed.sql
```

で D1 に反映する（`seed.sql` は冒頭で全 `DELETE` してから入れ直す）。

書き込み API と管理画面を用意した段階で D1 が正になり、この手順は不要になる。

## CORS

`src/index.js` の `ALLOWED_ORIGINS` に列挙したオリジンにのみ CORS ヘッダを返す。
GitHub Pages 以外から呼ぶ場合はここに追加する。

## 補足

- 無料枠: Workers 10万リクエスト/日、D1 500万行読み取り/日・5GB、Access 50ユーザーまで
- `/api/games` 1 回で 166 行（meta 1 + platforms 3 + series 17 + titles 145）を読むため、
  1 日あたり約 2 万ページ表示までは無料枠内
