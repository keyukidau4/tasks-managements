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

まず `api/` で依存パッケージをインストールし、環境設定ファイルを作成します。

macOS / Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Compose 内の API は PostgreSQL service の hostname `postgres` を使って接続します。`.env` にある `DATABASE_URL` は host 上で API を直接実行するときの接続先です。Compose で全サービスを起動する場合、Compose が要求する MinIO root credentials (`MINIO_ACCESS_KEY` と `MINIO_SECRET_KEY`) を `.env` にローカル専用の値として設定してください。これらの値を `.env.example`、README、その他の version 管理対象ファイルに記入しないでください。

PostgreSQL、Redis、Mailpit、MinIO を起動します。

```bash
docker compose up --build -d
```

Compose は API image を build し、PostgreSQL / Redis の healthcheck が成功した後に API を起動します。API container は起動時に既存 Prisma migration を適用してから HTTP server を開始します。API とすべての依存サービスの状態を確認します。

```bash
docker compose ps
```

API は `http://localhost:3000` で起動します（host 側 port は `PORT` で変更できます）。`GET /` は `Hello World!` を共通 response envelope で返し、`GET /health` はヘルス状態を返します。Swagger UI は `/docs`、OpenAPI JSON は `/docs-json` で確認できます。ログは `docker compose logs -f api` で確認できます。すべての container を停止するには `docker compose down` を実行してください。

`.env` を作成しない場合も API の開発用既定値で起動できますが、Compose は `.env` に MinIO root credentials がないと起動しません。ポートは `PORT`、ブラウザーからの接続を許可する origin は `CORS_ORIGINS`（カンマ区切り）で設定できます。許可 origin は完全な `http://` または `https://` origin で指定してください。設定値が不正な場合、API は起動時にエラーにします。

BullMQ は `REDIS_HOST`（既定値 `localhost`）、`REDIS_PORT`（既定値 `6379`）、任意の `REDIS_PASSWORD` で Redis に接続します。ローカル Compose の Redis は localhost のみに bind し、password なしで動作します。password を使う場合は `.env` にだけ設定し、本番では secret store から `REDIS_PASSWORD` を必ず渡してください（production では未設定だと起動時 validation に失敗します）。`notifications` queue は同時に 5 job を処理し、失敗時は指数 backoff で合計最大 3 回試行します。最終失敗 job は Redis に最大 1,000 件保持され、各失敗 attempt と最終失敗は log に記録します。

Task 作成時に assignee を指定した場合、および `PATCH /tasks/:id` で assignee が実際に変更された場合、`task-assigned` email job を `notifications` queue に登録します。job payload には recipient の email/name、task/project 名、操作ユーザー名を含みます。同一 task version の重複 enqueue は BullMQ の job ID で抑止します。

Email は Nodemailer から SMTP 送信します。ローカルの既定接続は `SMTP_HOST=localhost`、`SMTP_PORT=1025`、`SMTP_SECURE=false`、`SMTP_FROM=noreply@example.com` で Mailpit を使います。送信元アプリのリンク URL は `APP_URL`（既定値 `http://localhost:5173`）で指定します。本番では `SMTP_HOST` と `SMTP_FROM` を設定してください。SMTP 認証を使う場合は `SMTP_USER` と `SMTP_PASS` の両方を secret store から渡します。HTML email の task/project/user text は escape して出力します。Mailpit UI は `http://localhost:8025` で確認できます。

認証 API は `POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/me` を提供します。ログイン応答の refresh token は次回更新またはログアウト時に JSON body で送信します。アクセス token は 15 分の HS256 JWT、refresh token は 7 日のランダム token で、DB には SHA-256 hash のみ保存します。register / login / refresh / logout は各 route あたり 1 分 5 回に制限します。開発時の JWT secret はプロセスごとにランダム生成され、再起動すると既存 access token は無効になります。本番では `JWT_ACCESS_SECRET`（32 文字以上）を secret store から渡してください。値が未設定または短い場合、production 起動時の検証に失敗します。秘密値を `.env.example` やその他の version 管理対象ファイルに書かないでください。

## 環境変数

設定値は API 起動時に検証されます。Compose は `api/.env` を読み込み、PostgreSQL の `POSTGRES_*` と MinIO credentials を使います。秘密情報はローカルの ignore 対象 `api/.env` または deployment secret store にだけ置いてください。

| Variable                                                                                                                                 | 用途                                          | 既定値 / 必須条件                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                                               | 実行環境                                      | `development`                                                                                                     |
| `PORT`                                                                                                                                   | API listen port / Compose host port           | `3000`                                                                                                            |
| `DATABASE_URL`                                                                                                                           | Prisma PostgreSQL 接続 URL                    | local PostgreSQL の `task_management` database                                                                    |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`                                                                                    | Compose PostgreSQL 初期化                     | `task_app` / `task_app_local` / `task_management`。local development only                                         |
| `POSTGRES_HOST_PORT` / `REDIS_HOST_PORT` / `SMTP_HOST_PORT` / `MAILPIT_UI_HOST_PORT` / `MINIO_API_HOST_PORT` / `MINIO_CONSOLE_HOST_PORT` | Compose dependency services の host ports     | それぞれ `5432` / `6379` / `1025` / `8025` / `9000` / `9001`                                                      |
| `CORS_ORIGINS`                                                                                                                           | 許可する完全な HTTP(S) origin（カンマ区切り） | `http://localhost:5173`                                                                                           |
| `LOG_LEVEL`                                                                                                                              | Pino log level                                | `info`（`.env.example` は `debug`）                                                                               |
| `JWT_ACCESS_SECRET`                                                                                                                      | access JWT 署名 secret                        | development では process ごとに生成。本番では 32 文字以上を secret store から必須設定                             |
| `REDIS_HOST` / `REDIS_PORT`                                                                                                              | BullMQ 接続先                                 | `localhost` / `6379`                                                                                              |
| `REDIS_PASSWORD`                                                                                                                         | Redis password                                | 任意。本番では必須                                                                                                |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_FROM`                                                                                  | メール送信                                    | local Mailpit: `localhost` / `1025` / `false` / `noreply@example.com`。本番では `SMTP_HOST` と `SMTP_FROM` が必須 |
| `SMTP_USER` / `SMTP_PASS`                                                                                                                | SMTP 認証                                     | 任意だが両方設定する場合はペアで指定                                                                              |
| `APP_URL`                                                                                                                                | 通知メール内アプリ link                       | `http://localhost:5173`                                                                                           |
| `MINIO_ENDPOINT` / `MINIO_BUCKET`                                                                                                        | 添付ファイル storage                          | `http://localhost:9000` / `task-attachments`                                                                      |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`                                                                                                  | MinIO credentials                             | API の添付 upload 時に必要。Compose 起動時は MinIO root credentials として両方必須                                |
| `SEED_USER_EMAIL` / `SEED_USER_NAME` / `SEED_USER_PASSWORD_HASH`                                                                         | 任意の開発用 seed user                        | seed 実行時に設定。password は平文ではなく password hash                                                          |

Compose の `POSTGRES_PASSWORD` を変更するときは、それと一致する `DATABASE_URL` も更新してください。`.env.example` の database credentials は local development 専用で、本番環境では利用せず、実際の値を version 管理対象ファイルに記録しないでください。

## ローカル依存サービス

PostgreSQL 16、Redis 7、Mailpit、MinIO の既定接続先は次のとおりです。ホスト側 port が使用中の場合は `.env` の `POSTGRES_HOST_PORT`、`REDIS_HOST_PORT`、`SMTP_HOST_PORT`、`MAILPIT_UI_HOST_PORT`、`MINIO_API_HOST_PORT`、`MINIO_CONSOLE_HOST_PORT` で公開 port を変更できます。API の host port は `PORT` で変更します。

| Service       | URL / Port                                     | 用途                    |
| ------------- | ---------------------------------------------- | ----------------------- |
| API           | [http://localhost:3000](http://localhost:3000) | REST API / Swagger      |
| PostgreSQL    | `localhost:5432`                               | Database                |
| Redis         | `localhost:6379`                               | Queue / rate-limit 基盤 |
| Mailpit UI    | [http://localhost:8025](http://localhost:8025) | 開発用メールの確認      |
| Mailpit SMTP  | `localhost:1025`                               | 開発用 SMTP             |
| MinIO API     | `localhost:9000`                               | S3-compatible storage   |
| MinIO Console | [http://localhost:9001](http://localhost:9001) | 開発用ファイル管理      |

Compose は `.env` の値を使用します。MinIO credentials が未設定の場合は起動に失敗します。Compose の MinIO service は開発用の legacy OSS image を使用します。本番環境では保守中の MinIO distribution と deployment secret store を構成してください。サービス状態は `docker compose ps` で確認できます。`docker compose down -v` は DB、Redis、MinIO のデータ volume を削除するため、保持データが不要な場合に限り実行してください。

API image は `api/Dockerfile` で作成されます。schema を変更した後は image を再 build するため、`docker compose up --build -d` を再実行してください。

Redis / BullMQ、task assignment notification worker、Nodemailer SMTP 送信と Mailpit ローカル受信を実装しています。Prisma には User / Workspace と Task 管理用テーブルの schema / migration を含みます。

API は Prisma Client を使って PostgreSQL に接続します。`User` / `RefreshToken` / `Workspace` / `WorkspaceMember` / `Project` / `Task` / `TaskComment` / `TaskAttachment` / `AuditLog` の schema と migration を含みます。Project と Task は `deleted_at` による soft delete を使用します。通常削除ではレコードを保持し、関連コメント・添付も保持します。task の関連データが cascade delete されるのは task を物理削除した場合のみです。監査ログの `entity_id` は複数種類の entity を参照する polymorphic ID のため、単一テーブルへの FK は設定していません。

DB constraint は workspace member の workspace/user の組み合わせ、user email、refresh token hash、attachment file key を unique にします。Workspace member role、task status / priority、task version、attachment size は許可値・正数を CHECK 制約で検証します。Project / Task の soft delete 済みデータを含めて一意性を保つため、名前の unique 制約は付けていません。User や Project の履歴参照は物理削除を制限し、task assignee が物理削除された場合は assignee を NULL にします。Task の物理削除時のみ comment / attachment は cascade delete されます。

PostgreSQL を起動してから、`npm run prisma:generate` で Prisma Client を生成し、`npm run prisma:deploy` で既存 migration を適用します。開発中に schema を変更して新しい migration を作る場合は次を使います。

```bash
npm run prisma:generate
npm run prisma:migrate -- --name task_schema
```

既存 migration を production 等に適用するには `npm run prisma:deploy` を実行します。開発用ユーザーの初期化は任意です。`.env` に `SEED_USER_EMAIL`、`SEED_USER_NAME`、`SEED_USER_PASSWORD_HASH`（平文ではなく、アプリケーションで利用する password hash）を設定してから `npm run prisma:seed` を実行します。seed は production では実行できず、同じ email の既存ユーザーは変更しません。Prisma Studio は `npm run prisma:studio` で起動します。接続先は `DATABASE_URL` で設定し、ローカル既定値は `api/.env.example` を参照してください。

実際の接続情報や秘密鍵は version 管理対象のファイルに記載せず、ignore 対象の `api/.env` かデプロイ環境の secret store に設定してください。`.env.example` と Compose の既定 credentials はローカル開発専用であり、production では使用しないでください。

## 利用可能なコマンド

すべて `api/` ディレクトリで実行してください。

| コマンド                                  | 説明                                       |
| ----------------------------------------- | ------------------------------------------ |
| `npm run start:dev`                       | watch モードで API を起動                  |
| `npm run start`                           | watch モードなしで API を起動              |
| `npm run build`                           | アプリケーションを `dist/` にコンパイル    |
| `npm run start:prod`                      | コンパイル済みアプリケーションを実行       |
| `npm test`                                | unit test を実行                           |
| `npm run test:e2e`                        | end-to-end test を実行                     |
| `npm run test:cov`                        | coverage を計測しながら unit test を実行   |
| `npm run prisma:generate`                 | Prisma Client を生成                       |
| `npm run prisma:migrate -- --name <name>` | 開発用 migration を作成・適用              |
| `npm run prisma:deploy`                   | 既存 migration を適用                      |
| `npm run prisma:seed`                     | 環境変数から開発用ユーザーを初期化（任意） |
| `npm run prisma:studio`                   | Prisma Studio を起動                       |
| `npm run format`                          | Prettier でソースとテストファイルを整形    |
| `npm run lint`                            | ESLint による読み取り専用の静的検査        |

## Migration と test

migration は API 起動時に自動適用されません。新規 clone 後、または schema を変更した後に PostgreSQL を起動してから、次を実行してください。

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
```

開発用 schema migration を新規作成するときは `npm run prisma:migrate -- --name <migration_name>` を実行してください。migration を適用した後、必要なら API を `npm run start:dev` で起動します。

| Command                           | 内容 / 前提                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                   | TypeScript / NestJS production build                                                                                              |
| `npm run lint`                    | ESLint 静的検査。ファイルは変更しません                                                                                           |
| `npm test -- --runInBand`         | unit tests。外部サービスを必要としません                                                                                          |
| `npm run test:e2e -- --runInBand` | 全 e2e tests。PostgreSQL / Redis を起動し、migration を適用してから実行します。テストは専用のランダムデータを作成・cleanup します |
| `npm run test:cov`                | unit test coverage                                                                                                                |

全体を手動で確認するには、依存サービスの起動と migration の適用後、上記 build、lint、unit、e2e の各 command を順に実行します。GitHub Actions でも同じ検査を実行します（[CI workflow](../.github/workflows/ci.yml)）。

## CI

GitHub Actions は push、pull request、手動実行時に [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) を実行します。PostgreSQL 16 と Redis 7 を起動し、依存関係の導入、Prisma Client 生成、migration 適用の後に build、lint、unit test、e2e test を実行します。CI 専用のテスト接続情報を workflow 内で使用し、production secret は必要ありません。

## 現在の実装状況

- `GET /` と `GET /health` を提供します。
- 成功 response は `{ "success": true, "data": ... }`、error response は設計書に沿った envelope で返します。
- Swagger UI は API 起動後に `http://localhost:3000/docs`、OpenAPI JSON は `http://localhost:3000/docs-json` で確認できます。endpoint、path/query parameter、request DTO、multipart attachment upload と bearer authentication を掲載しています。保護された API は Swagger UI の Authorize に access token を入力して実行できます。
- Error envelope は `{ "success": false, "error": { "code": ..., "message": ..., "details": [...] } }` です。400 / 401 / 403 / 404 / 409 / 429 は個別の error code に対応し、500 は内部情報を返さず `INTERNAL_SERVER_ERROR` として記録します。
- 環境変数の起動時検証、DTO validation、例外処理、request ID 付き Pino logging を設定しています。
- Helmet、CORS allowlist、全体の rate limit と認証 route 専用 rate limit を設定しています。
- 認証、workspace/project/task、コメント、添付、統計、通知、response/error mapping、OpenAPI の unit test / e2e test が含まれます。

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
- `GET /projects/:id/statistics/progress` は workspace member に Project の active task 総数と status ごとの件数を返します（0 件の status も含む）。
- `GET /workspaces/:id/statistics/workload` は workspace member ごとの active assigned task 総数と status ごとの件数を返します。Task が割り当てられていない場合は workload に含めず、Task の soft delete 済みレコードと soft delete 済み Project の task は除外します。Task のない member も件数 0 で返します。
- `GET /workspaces/:id/statistics/overdue` は workspace member に現在時刻より前が due date で、DONE ではなく、soft delete されていない Task の一覧と総数を返します。soft delete 済み Project の Task は除外し、Task ID で安定して並びを決定します。統計結果は現時点では cache せず、due date と状態の変更を即時反映します。

以下の業務機能は未実装です。

- attachment の download / delete API

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
