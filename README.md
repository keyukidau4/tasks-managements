# Team Task Management API

チームのタスク・進捗管理アプリケーション向けのバックエンド REST API です。NestJS と TypeScript で構築しています。

現在のリポジトリには NestJS の初期 scaffold が含まれています。設計書に記載されているデータベース、認証、業務機能は、まだ実装されていません。

## 必要な環境

- Node.js 22 LTS（現在の NestJS 11 ツールチェーンには Node.js 20.11 以降が必要です）
- npm
- Git

現時点の scaffold を起動するために PostgreSQL、Redis、MinIO、Docker、Docker Compose は不要です。各サービスとの連携を実装した段階で必要になります。

## Clone と起動方法

ターミナルでリポジトリを clone し、API プロジェクトのディレクトリに移動します。

```bash
git clone https://github.com/keyukidau4/tasks-managements
npm ci
npm run start:dev
```

開発サーバーは、既定でポート `3000` を使用します。[http://localhost:3000](http://localhost:3000) を開くと、初期 scaffold のエンドポイントから `Hello World!` が返ります。

ポートを変更する場合は、起動前に環境変数 `PORT` を設定してください。

```bash
# macOS / Linux
PORT=3001 npm run start:dev
```

```powershell
# Windows PowerShell
$env:PORT = "3001"
npm run start:dev
```

開発サーバーを停止するには `Ctrl+C` を押してください。

## 利用可能なコマンド

以下のコマンドは ディレクトリで実行してください。

| コマンド | 説明 |
| --- | --- |
| `npm run start:dev` | watch モードで API を起動 |
| `npm run start` | watch モードなしで API を起動 |
| `npm run build` | アプリケーションを `dist/` にコンパイル |
| `npm run start:prod` | コンパイル済みアプリケーションを実行 |
| `npm test` | unit test を実行 |
| `npm run test:e2e` | end-to-end test を実行 |
| `npm run test:cov` | coverage を計測しながら unit test を実行 |
| `npm run format` | Prettier でソースとテストファイルを整形 |
| `npm run lint` | ESLint を実行（設定済みコマンドは修正も適用します） |

ローカルで production build を実行する場合：

```bash
npm ci
npm run build
npm run start:prod
```

## 現在の実装状況

現在の API は NestJS の初期 scaffold です。

- `GET /` は `Hello World!` を返します。
- 初期の unit test と e2e test が含まれています。
- データベース接続や環境設定ファイルは必要ありません。

以下はバックエンド設計に含まれていますが、まだ利用できません。

- PostgreSQL 16、Prisma schema、migration
- 新規登録、ログイン、JWT access/refresh token、role-based authorization
- Workspace、project、task、comment、attachment、statistics の各 API
- Redis/BullMQ によるメールジョブ、Nodemailer/Mailpit、MinIO ファイルストレージ
- Swagger/OpenAPI ドキュメント、Docker Compose サービス

アプリケーションコードとローカル実行環境が追加されるまでは、本番用認証情報を設定したり、これらのサービスが動作すると想定したりしないでください。

## 設計書

バックエンドの要件、API 設計、データモデル、ローカル開発環境、テストシナリオについては [`../basics-design.md`](../basics-design.md) を参照してください。設計書に記載された内容が、すべてこの scaffold に実装済みであることを示すものではありません。

## ディレクトリ構成

```text
src/
  app.controller.ts
  app.module.ts
  app.service.ts
  main.ts
test/
  app.e2e-spec.ts
  jest-e2e.json
package.json
```

バックエンド機能の実装に合わせて、feature module と共通基盤を追加していきます。
