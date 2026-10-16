# API 開発タスク一覧

バックエンド設計書 [`../basics-design.md`](../basics-design.md) に基づく実装タスクです。完了した項目は `[x]` に変更してください。

## 1. 基盤・開発環境

- [x] NestJS の初期 scaffold を機能別のモジュール構成に整理する
- [x] 設定ファイルの読み込みと環境変数の検証を実装する
- [x] `.env.example` と `.gitignore` を整備し、秘密情報を Git に含めない
- [x] 共通 API response / error response の形式を実装する
- [x] DTO validation、例外フィルター、共通 interceptor を設定する
- [x] CORS allowlist、Helmet、全体 rate limiting と認証 route 用 decorator を設定する
- [x] request ID 付き structured logging を設定する
- [x] `GET /health` を実装する
- [x] PostgreSQL 16、Redis 7、Mailpit、MinIO を含む Docker Compose 環境を作成する
- [x] 開発環境の起動・停止・初期化手順を README に記載する

## 2. データベース・Prisma

- [x] Prisma を導入し、PostgreSQL への接続設定を実装する
- [ ] `User` と `RefreshToken` の schema、migration、初期化処理を作成する
- [ ] `Workspace` と `WorkspaceMember` の schema、migration を作成する
- [ ] `Project` の schema、migration を作成する
- [ ] `Task` の schema、migration を作成する
- [ ] `TaskComment` と `TaskAttachment` の schema、migration を作成する
- [ ] `AuditLog` の schema、migration を作成する
- [ ] 外部キー、unique constraint、index、soft delete の扱いを定義する
- [x] Prisma service/module とアプリケーション終了時の接続解放を実装する
- [ ] migration の実行・開発用データ投入手順を確認する

## 3. 認証・ユーザー

- [ ] ユーザー登録 `POST /auth/register` を実装する
- [ ] パスワード hash（bcrypt または argon2）と重複メール検査を実装する
- [ ] ログイン `POST /auth/login` と access token 発行を実装する
- [ ] refresh token の保存、hash 化、有効期限管理を実装する
- [ ] token 更新 `POST /auth/refresh` と token rotation/revoke を実装する
- [ ] ログアウト `POST /auth/logout` を実装する
- [ ] 現在のユーザー取得 `GET /auth/me` を実装する
- [ ] access token の認証 guard と認証 decorator を実装する
- [ ] access token（15 分）と refresh token（7 日）の有効期限を設定する
- [ ] 認証 API の validation、rate limiting、異常系をテストする

## 4. Workspace・メンバー管理

- [ ] Workspace 作成 `POST /workspaces` を実装する
- [ ] Workspace 取得 `GET /workspaces/:id` を実装する
- [ ] Workspace 更新 `PATCH /workspaces/:id` を実装する
- [ ] メンバー招待 `POST /workspaces/:id/members` を実装する
- [ ] メンバー削除 `DELETE /workspaces/:id/members/:userId` を実装する
- [ ] OWNER / ADMIN / MEMBER の role と認可 guard を実装する
- [ ] 全 workspace-scoped endpoint で membership を検査する
- [ ] Workspace とメンバー操作の unit test / e2e test を追加する

## 5. Project

- [ ] Project 作成 `POST /workspaces/:id/projects` を実装する
- [ ] Workspace 内の Project 一覧 `GET /workspaces/:id/projects` を実装する
- [ ] Project 詳細 `GET /projects/:id` を実装する
- [ ] Project 更新 `PATCH /projects/:id` を実装する
- [ ] Project 削除 `DELETE /projects/:id` を実装する
- [ ] 操作者の workspace membership と role を各 endpoint で検査する
- [ ] Project の validation、認可、soft delete の test を追加する

## 6. Task・コメント・添付ファイル

- [ ] Task 作成 `POST /projects/:id/tasks` を実装する
- [ ] Task 一覧 `GET /projects/:id/tasks` を実装する
- [ ] Task 詳細 `GET /tasks/:id` を実装する
- [ ] Task 更新 `PATCH /tasks/:id` を実装する
- [ ] Task 削除 `DELETE /tasks/:id` を soft delete として実装する
- [ ] status（TODO / IN_PROGRESS / IN_REVIEW / DONE）を実装する
- [ ] priority（LOW / MEDIUM / HIGH / URGENT）を実装する
- [ ] assignee、due date、filter、sort、pagination を実装する
- [ ] pagination の既定値（page 1、limit 20）と上限（100）を適用する
- [ ] `version` を使用した optimistic locking と競合時の `409 CONFLICT` を実装する
- [ ] Task 作成・更新と audit log 記録を transaction で処理する
- [ ] Task comment の取得・追加 API を実装する
- [ ] MinIO への添付ファイル upload と metadata 保存を実装する
- [ ] ファイルサイズ、MIME type、認可を検証する
- [ ] Task、comment、attachment の unit test / e2e test を追加する

## 7. 統計

- [ ] Project ごとの status 別 task 数 `GET /projects/:id/statistics/progress` を実装する
- [ ] Workspace ごとの member workload `GET /workspaces/:id/statistics/workload` を実装する
- [ ] Workspace の overdue task `GET /workspaces/:id/statistics/overdue` を実装する
- [ ] 統計 query の正確性と workspace 認可をテストする
- [ ] 必要に応じて Redis cache（TTL 30〜60 秒）を導入する

## 8. 通知・バックグラウンドジョブ

- [ ] Redis と BullMQ の queue/worker を設定する
- [ ] assignee 変更時など、通知対象イベントから email job を登録する
- [ ] Nodemailer と Mailpit を接続する
- [ ] email job の retry（最大 3 回）と failed job の記録を実装する
- [ ] 通知 job の成功・失敗をテストする

## 9. API ドキュメント・テスト・品質

- [ ] Swagger / OpenAPI を導入し、全 endpoint と DTO を文書化する
- [ ] success/error response envelope を API 全体で統一する
- [ ] `400 / 401 / 403 / 404 / 409 / 429 / 500` の error mapping を整備する
- [ ] 各 service の unit test を追加する
- [ ] 主要な業務フローの e2e test を追加する
- [ ] 未認証 `401`、権限不足 `403`、validation error `400` を検証する
- [ ] 同時更新の `409` と workspace 間のデータ分離を検証する
- [ ] build、lint、unit test、e2e test を CI で実行する
- [ ] README に実装済み機能、環境変数、起動、migration、test の手順を反映する

## 10. 完了条件

- [ ] Docker Compose で API と依存サービスを起動できる
- [ ] migration 適用後、登録から workspace/project/task 作成まで実行できる
- [ ] 認証・認可がすべての保護対象 endpoint で機能する
- [ ] OpenAPI UI から API を確認・実行できる
- [ ] build、lint、unit test、e2e test が成功する
- [ ] 新しく clone した開発者が README の手順で環境を再現できる
