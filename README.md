# Team Task Management API

チームのタスク・進捗管理アプリケーション向けのバックエンド REST API です。NestJS と TypeScript で構築しています。

## 必要な環境

- Node.js 22 LTS（NestJS 11 は Node.js 20.11 以降が必要です）
- npm
- Git
- Docker Desktop（PostgreSQL、Redis、Mailpit、MinIO を起動する場合）

## Clone と起動方法

```bash
git clone https://github.com/keyukidau4/tasks-managements
cd tasks-managements/api
npm ci
```

`.env` は API 起動時に必須ではありません。PostgreSQL 接続 URL はローカル開発用の既定値が設定されています。PostgreSQL を含む依存サービスを起動してから API を実行してください。ポートや CORS 許可 origin、DB 接続 URL を変更する場合は、サンプルをコピーして編集します。

macOS / Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

開発サーバーを起動します。

```bash
npm run start:dev
```

既定では `http://localhost:3000` で起動します。`GET /` は `Hello World!` を共通 response envelope で返し、`GET /health` はヘルス状態を返します。開発サーバーを停止するには `Ctrl+C` を押してください。

`.env` を作成しない場合も既定値で起動できます。ポートは `PORT`、ブラウザーからの接続を許可する origin は `CORS_ORIGINS`（カンマ区切り）で設定できます。許可 origin は完全な `http://` または `https://` origin で指定してください。設定対象の環境変数に不正な値がある場合、API は起動時にエラーにします。

## ローカル依存サービス

PostgreSQL 16、Redis 7、Mailpit、MinIO を起動する場合は、`api/` で次を実行します。

```bash
docker compose up -d
```

| Service       | URL / Port                                     | 用途                    |
| ------------- | ---------------------------------------------- | ----------------------- |
| PostgreSQL    | `localhost:5432`                               | Database                |
| Redis         | `localhost:6379`                               | Queue / rate-limit 基盤 |
| Mailpit UI    | [http://localhost:8025](http://localhost:8025) | 開発用メールの確認      |
| Mailpit SMTP  | `localhost:1025`                               | 開発用 SMTP             |
| MinIO API     | `localhost:9000`                               | S3-compatible storage   |
| MinIO Console | [http://localhost:9001](http://localhost:9001) | 開発用ファイル管理      |

Compose は `.env` の値を使用し、未設定の場合は `.env.example` と同じローカル専用値を使用します。これらの初期値をローカル開発以外で使用しないでください。サービスを停止するには `docker compose down` を実行します。データ volume も削除する場合は `docker compose down -v` を実行してください。

Redis、Mailpit、MinIO との API 接続、Workspace 以降の業務用 DB schema / migration は未実装です。Compose は開発依存サービスの起動環境を用意するもので、業務機能を有効化するものではありません。

API は Prisma Client を使って PostgreSQL に接続します。`User` / `RefreshToken` の schema と migration を含みます。PostgreSQL を起動してから、開発環境では migration の作成・適用に以下を使います。

```bash
npm run prisma:generate
npm run prisma:migrate -- --name user_refresh_tokens
```

既存 migration を production 等に適用するには `npm run prisma:deploy` を実行します。開発用ユーザーの初期化は任意です。`.env` に `SEED_USER_EMAIL`、`SEED_USER_NAME`、`SEED_USER_PASSWORD_HASH`（平文ではなく、アプリケーションで利用する password hash）を設定してから `npm run prisma:seed` を実行します。seed は production では実行できず、同じ email の既存ユーザーは変更しません。Prisma Studio は `npm run prisma:studio` で起動します。接続先は `DATABASE_URL` で設定し、ローカル既定値は `api/.env.example` を参照してください。

## 利用可能なコマンド

すべて `api/` ディレクトリで実行してください。

| コマンド                                  | 説明                                                |
| ----------------------------------------- | --------------------------------------------------- |
| `npm run start:dev`                       | watch モードで API を起動                           |
| `npm run start`                           | watch モードなしで API を起動                       |
| `npm run build`                           | アプリケーションを `dist/` にコンパイル             |
| `npm run start:prod`                      | コンパイル済みアプリケーションを実行                |
| `npm test`                                | unit test を実行                                    |
| `npm run test:e2e`                        | end-to-end test を実行                              |
| `npm run test:cov`                        | coverage を計測しながら unit test を実行            |
| `npm run prisma:generate`                 | Prisma Client を生成                                |
| `npm run prisma:migrate -- --name <name>` | 開発用 migration を作成・適用                       |
| `npm run prisma:deploy`                   | 既存 migration を適用                               |
| `npm run prisma:seed`                     | 環境変数から開発用ユーザーを初期化（任意）          |
| `npm run prisma:studio`                   | Prisma Studio を起動                                |
| `npm run format`                          | Prettier でソースとテストファイルを整形             |
| `npm run lint`                            | ESLint を実行（設定済みコマンドは修正も適用します） |

## 現在の実装状況

- `GET /` と `GET /health` を提供します。
- 成功 response は `{ "success": true, "data": ... }`、error response は設計書に沿った envelope で返します。
- 環境変数の起動時検証、DTO validation、例外処理、request ID 付き Pino logging を設定しています。
- Helmet、CORS allowlist、全体の rate limit を設定しています。認証 route 用の `AuthRateLimit` decorator は認証 API の追加時に適用します。
- 初期 scaffold、response envelope、health check、error response、request ID の unit test / e2e test が含まれます。

以下の業務機能は未実装です。

- Workspace 以降の業務データ用 PostgreSQL schema / migration（User / RefreshToken は実装済み）
- 新規登録、ログイン、JWT、Workspace / Project / Task 等の API
- Redis/BullMQ による email job、Nodemailer、MinIO 連携
- Swagger / OpenAPI

## ディレクトリ構成

```text
src/
  common/
    decorators/
    filters/
    interceptors/
  config/
  prisma/
  health/
  home/
  app.module.ts
  main.ts
test/
docker-compose.yml
.env.example
```

バックエンド機能の実装状況と次の作業は [`tasks.md`](./tasks.md)、設計は [`../basics-design.md`](../basics-design.md) を参照してください。
