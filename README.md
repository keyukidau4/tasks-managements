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

認証 API は `POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/me` を提供します。ログイン応答の refresh token は次回更新またはログアウト時に JSON body で送信します。アクセス token は 15 分の HS256 JWT、refresh token は 7 日のランダム token で、DB には SHA-256 hash のみ保存します。register / login / refresh / logout は各 route あたり 1 分 5 回に制限します。開発時の JWT secret はプロセスごとにランダム生成され、再起動すると既存 access token は無効になります。本番では `JWT_ACCESS_SECRET`（32 文字以上）を secret store から渡してください。値が未設定または短い場合、production 起動時の検証に失敗します。秘密値を `.env.example` やその他の version 管理対象ファイルに書かないでください。

## ローカル依存サービス

PostgreSQL 16、Redis 7、Mailpit、MinIO を起動する場合は、`api/` で次を実行します。MinIO の `MINIO_ACCESS_KEY` と `MINIO_SECRET_KEY` は `.env` にローカルで設定し、Compose が MinIO root credentials として使用します。これらの値を version 管理対象ファイルに書かないでください。

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

Compose は `.env` の値を使用します。MinIO credentials が未設定の場合は起動に失敗します。サービスを停止するには `docker compose down` を実行します。データ volume も削除する場合は `docker compose down -v` を実行してください。

Redis と Mailpit との API 接続は未実装です。Prisma には User / Workspace と Task 管理用テーブルの schema / migration を含みます。

API は Prisma Client を使って PostgreSQL に接続します。`User` / `RefreshToken` / `Workspace` / `WorkspaceMember` / `Project` / `Task` / `TaskComment` / `TaskAttachment` / `AuditLog` の schema と migration を含みます。Project と Task は `deleted_at` による soft delete を使用します。通常削除ではレコードを保持し、関連コメント・添付も保持します。task の関連データが cascade delete されるのは task を物理削除した場合のみです。監査ログの `entity_id` は複数種類の entity を参照する polymorphic ID のため、単一テーブルへの FK は設定していません。

DB constraint は workspace member の workspace/user の組み合わせ、user email、refresh token hash、attachment file key を unique にします。Workspace member role、task status / priority、task version、attachment size は許可値・正数を CHECK 制約で検証します。Project / Task の soft delete 済みデータを含めて一意性を保つため、名前の unique 制約は付けていません。User や Project の履歴参照は物理削除を制限し、task assignee が物理削除された場合は assignee を NULL にします。Task の物理削除時のみ comment / attachment は cascade delete されます。

PostgreSQL を起動してから、`npm run prisma:deploy` で既存 migration を適用できます。開発中に schema を変更して新しい migration を作る場合は次を使います。

```bash
npm run prisma:generate
npm run prisma:migrate -- --name task_schema
```

既存 migration を production 等に適用するには `npm run prisma:deploy` を実行します。開発用ユーザーの初期化は任意です。`.env` に `SEED_USER_EMAIL`、`SEED_USER_NAME`、`SEED_USER_PASSWORD_HASH`（平文ではなく、アプリケーションで利用する password hash）を設定してから `npm run prisma:seed` を実行します。seed は production では実行できず、同じ email の既存ユーザーは変更しません。Prisma Studio は `npm run prisma:studio` で起動します。接続先は `DATABASE_URL` で設定し、ローカル既定値は `api/.env.example` を参照してください。

実際の接続情報や秘密鍵は version 管理対象のファイルに記載せず、ignore 対象の `api/.env` かデプロイ環境の secret store に設定してください。`.env.example` と Compose の既定 credentials はローカル開発専用であり、production では使用しないでください。

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

Workspace と認証の以下の endpoint を実装済みです。

- `POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/me`
- `POST /workspaces`、`GET /workspaces/:id`、`PATCH /workspaces/:id`。Workspace 作成時に OWNER membership を追加します。`WorkspaceRolesGuard` は workspace ID を持つ route で常に membership を検証し、ロール指定がない場合は全 membership role を許可します。取得は OWNER / ADMIN / MEMBER、更新は OWNER / ADMIN のみ許可します。
- `POST /workspaces/:id/members`、`DELETE /workspaces/:id/members/:userId`。既存ユーザーを email で MEMBER として追加し、OWNER / ADMIN が非 OWNER メンバーを削除できます。workspace owner 自身は削除できません。
- `POST /workspaces/:id/projects`、`GET /workspaces/:id/projects`、`GET /projects/:id`、`PATCH /projects/:id`、`DELETE /projects/:id`。全 endpoint で workspace membership を検証し、一覧と詳細は全 role、作成・更新・削除は OWNER / ADMIN のみ許可します。削除は `deleted_at` を設定する soft delete です。
- `POST /projects/:id/tasks`、`GET /projects/:id/tasks`、`GET /tasks/:id`、`PATCH /tasks/:id`、`DELETE /tasks/:id`。全 endpoint で project の workspace membership を検証し、全 workspace role に CRUD を許可します。削除は `deleted_at` を設定する soft delete です。status（TODO / IN_PROGRESS / IN_REVIEW / DONE）、priority（LOW / MEDIUM / HIGH / URGENT）、assignee、due date を作成・更新できます。
- `GET /projects/:id/tasks` は `status`、`priority`、`assigneeId`、`dueDateFrom` / `dueDateTo` で filter できます。`sortBy`（createdAt / updatedAt / dueDate / title / status / priority）と `sortOrder`（asc / desc）で sort でき、`page` / `limit` で pagination できます。response は `{ items, pagination: { page, limit, total, totalPages } }`、既定値は page 1 / limit 20、limit の最大値は 100 です。
- Task の作成・更新と `TASK_CREATED` / `TASK_UPDATED` audit log の保存は同一 DB transaction で実行します。`PATCH /tasks/:id` は最新の `version`（1 以上の整数）を必須とし、version を条件に atomic に更新して成功時に 1 増加させます。version が古い場合は `409 CONFLICT` を返すため、最新の Task を再取得してから再試行してください。
- `GET /tasks/:id/comments` と `POST /tasks/:id/comments` でコメントを取得・追加できます。投稿者の ID と表示名を返し、認可は task の workspace membership に基づきます。
- `GET /tasks/:id/attachments` は添付 metadata を返し、`POST /tasks/:id/attachments` は multipart field `file` を MinIO に保存して metadata を PostgreSQL に記録します。最大サイズは 10 MiB、許可形式は signature を検証した PDF / JPEG / PNG です。task の workspace member のみ利用でき、MinIO credentials はローカル `.env` または deployment secret store から供給します。

以下の業務機能は未実装です。

- attachment の download / delete API
- Redis/BullMQ による email job、Nodemailer、Redis / Mailpit 連携
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
  auth/
  workspaces/
  health/
  home/
  app.module.ts
  main.ts
test/
docker-compose.yml
.env.example
```

バックエンド機能の実装状況と次の作業は [`tasks.md`](./tasks.md)、設計は [`../basics-design.md`](../basics-design.md) を参照してください。
