# Observator

自宅の温湿度・気圧・CO2 の観測値を蓄積し、外出先からも閲覧できるようにするダッシュボードである。ESP32 セントラルが送る観測値を Cloudflare Workers で受け取り、D1 に保存する。

構成と設計判断は [DESIGN.md](DESIGN.md) にまとめてある。

## 開発

[mise](https://mise.jdx.dev/) で Node と Bun のバージョンをそろえる。コマンドは `mise x -- bun run build` のように mise 経由で実行する。

- `mise.toml` の `activate_aggressive` により、PATH にシステムの Node が先にあっても mise で固定した版が使われる

```sh
mise install
bun install
cp .dev.vars.example .dev.vars
bun run db:migrate:local
bun run dev
```

- 開発サーバは `http://localhost:15173/` で動く
- 例示データを入れるときは `node scripts/seed-local.mjs > .wrangler/seed.sql` のあと `bunx wrangler d1 execute DB --local --file .wrangler/seed.sql` を実行する
- `.dev.vars` の `DEV_AUTH_EMAIL` を設定すると、localhost からのアクセスに限り Access の検証を省く

| コマンド                    | 内容                                            |
| --------------------------- | ----------------------------------------------- |
| `bun run test`              | Workers ランタイム上でテストを実行する          |
| `bun run typecheck`         | 型を検査する                                    |
| `bun run cf-typegen`        | `wrangler.jsonc` を変えたあとに型定義を作り直す |
| `bun run deploy`            | ビルドしてデプロイする                          |
| `bun run db:migrate:remote` | 本番の D1 にマイグレーションを適用する          |

## 初回デプロイ

Access を設定してからデプロイする。順序を逆にすると、保護されていない状態で公開される時間ができる。ただし Worker は Access の設定値がないと全 API を 500 で拒否するので、値が漏れることはない。

### 1. Access アプリケーションを作る

Cloudflare Zero Trust のダッシュボードで操作する。

1. Settings → Authentication で、ログイン方法に One-time PIN があることを確かめる
2. Access → Service credentials → Service Tokens で、ESP32 用のサービストークンを作る
   - Client ID と Client Secret を控える
   - 有効期限を切らすと ESP32 が送信できなくなるので、期限を把握しておく
3. Access → Applications で Self-hosted のアプリケーションを追加する
   - ドメインは `observator.nanase.cc`
   - セッションの有効期間は 1 か月程度にする
4. アプリケーションにポリシーを 2 つ付ける
   - Allow: Include に自分のメールアドレス
   - Service Auth: Include に手順 2 のサービストークン
5. アプリケーションの AUD タグを控える

### 2. デプロイする

```sh
bunx wrangler login
bun run deploy
bun run db:migrate:remote
```

- 初回のデプロイで D1 データベース `observator` が自動で作られる
- カスタムドメインの DNS レコードも自動で作られる

### 3. Secret を設定する

```sh
bunx wrangler secret put ACCESS_TEAM_DOMAIN   # <team>.cloudflareaccess.com
bunx wrangler secret put ACCESS_AUD           # 手順 1 の AUD タグ
bunx wrangler secret put INGEST_CLIENT_ID     # 手順 1 の Client ID
```

### 4. 受信を確かめる

サービストークンで観測値を 1 件送り、`accepted` が 1 になることを確かめる。

```sh
now=$(date +%s)
curl -X POST https://observator.nanase.cc/api/ingest \
  -H "CF-Access-Client-Id: <Client ID>" \
  -H "CF-Access-Client-Secret: <Client Secret>" \
  -H "Content-Type: application/json" \
  -d "{\"central\":\"00:00:00:00:00:01\",\"sentAt\":$now,\"readings\":[{\"address\":\"00:00:00:00:00:01\",\"kind\":\"ESP32-Central\",\"observedAt\":$now,\"temperature\":25}]}"
```

- 確認に使ったアドレスはデバイス一覧に残る
  - 実機のセントラルが送り始めたら、画面から無視に切り替える
