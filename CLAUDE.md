# ymnkcrcr.github.io

山中康寛のポートフォリオサイト。ビルドツールなしの静的サイトで、実体は `index.html`
1ファイル（HTML + CSS + JS を内包、約2,950行）。GitHub Actions で GitHub Pages に配信する。

## 構成

```
index.html              サイト本体
data/*.json             趣味データ（games / drinks / cooking / movies / travel）
worker/                 Cloudflare Workers + D1（移行作業中。未デプロイ）
firebase-config.js      gitignore対象。Actions が Secrets から生成する
.github/workflows/      main への push で gh-pages へ配信
```

外部依存はすべて実行時 CDN ロード（Google Fonts / AOS / Chart.js / Firebase SDK 9.22.2 compat）。

## 進行中: 趣味データの Cloudflare D1 移行

学習目的を兼ねた移行。全6フェーズ中3つ完了、**フェーズ4で停止中**。

| # | 内容 | 状態 |
|---|---|---|
| 1 | HTMLベタ書き → `data/*.json` に分離 | 完了 |
| 2 | ゲームシリーズ9件追加（17シリーズ / 145タイトル） | 完了 |
| 3 | Worker + D1 構築、ローカル検証 | 完了 |
| 4 | **Cloudflareへデプロイ** | **停止中。ユーザーの作業待ち** |
| 5 | 書き込みAPI + Cloudflare Access | 未着手 |
| 6 | Firebase撤去、`data/` を `seed/` へ | 未着手 |

**フェーズ4が止まっている理由**: `wrangler login` がブラウザ認証を要求するため、
エージェント側からは実行できない。Cloudflare 上にはまだ何も存在しない（D1もWorkerも未作成）。
手順は `worker/README.md` にある。

作業ブランチは `claude/current-situation-v5mb0t`。**main には未マージ**で、本番サイトは
移行前の状態のまま動いている。

## データの扱い

**現在の正は `data/*.json`。** データを追加・修正するときは `index.html` ではなく
JSON を編集する。カードのDOMはJSONから生成される。

`data/games.json` のフィールド制約:

| フィールド | 取りうる値 |
|---|---|
| `platform` | `nintendo` / `playstation` / `pc` |
| `badge.type` | `loved` / `clear` / `playing`（CSSクラスが対応） |
| `stars` `rating` | 0〜5 の数値。★文字列は描画時に生成する |

### 落とし穴

- **Firebase が JSON より優先される。** 各タイトルの `played` / `stars` は Firebase の
  `gamePlayData` に記録があればそちらが勝つ。一度でも管理画面から保存したタイトルは
  JSON を直しても画面が変わらない。
- **カード表面の `stars` は JSON のみ。** Firebase は関与しない。モーダル内の各タイトルの
  ★とは別物。
- **D1移行までは JSON 側で直すこと。** 管理画面から保存すると Firebase に記録ができ、
  移行時に JSON と Firebase の突き合わせが必要になる。JSON だけで完結させておけば、
  移行は「JSONを読んでINSERTを吐く」だけで済む。
- **`worker/seed.sql` は生成物。** 手書きせず `node worker/scripts/generate-seed.mjs` で
  `data/games.json` から生成する。アポストロフィ等のエスケープを自動処理するため。
- **`played` / `stars` / `badge.label` / `note` の一部は暫定値。** 追加した9シリーズ分は
  エージェントが置いた仮の値で、実際のプレイ状況とは異なる。ユーザーの確認待ち。

## API 接続

`index.html` の `API_BASE_DEFAULT` が空文字なら `data/*.json` を読む（現在の状態）。
Worker の URL を設定すると `games` のみ D1 から取得し、**API 取得に失敗したら
`data/games.json` へ自動フォールバック**する。

`AOS.init()` にガードがあるのは、CDN障害時に例外で以降の描画処理が止まり、
趣味ページが空になるのを防ぐため。外さないこと。

## デプロイ

`main` への push のみで GitHub Pages に反映される。作業ブランチへの push では
本番は変わらない。`worker/` は `exclude_assets` で配信対象外。

## 検証方法

ブラウザ実機確認には Playwright（グローバル導入済み）を使う。`fetch` を使うため
`file://` では動かない。`python3 -m http.server` 経由で開くこと。

```bash
node worker/scripts/generate-seed.mjs                              # seed再生成
python3 -m json.tool data/games.json > /dev/null && echo OK        # JSON検証
cd worker && npx wrangler dev --local                              # Worker + ローカルD1
```
