---
title: 開発フロー
layer: tooling
type: guide
tags: [development, workflow, commands]
---

# 開発フロー

## セットアップ

VS Code + Dev Containers の利用を推奨。詳細はルート [readme.md](../../readme.md#development) を参照。

## コマンド一覧

| コマンド             | 説明                                        |
| -------------------- | ------------------------------------------- |
| `pnpm test`          | Vitest watch モード                         |
| `pnpm test:run`      | Vitest 1回実行                              |
| `pnpm typecheck`     | tsgo で型チェック (`tsgo --build`)          |
| `pnpm lint`          | oxlint                                      |
| `pnpm lint:fix`      | oxlint 自動修正                             |
| `pnpm format`        | oxfmt フォーマット                          |
| `pnpm format:dry`    | oxfmt --check（フォーマット差分の検出のみ） |
| `pnpm build`         | 全パッケージビルド (`pnpm -r build`)        |
| `pnpm check`         | format:dry → lint → typecheck → test:run    |
| `pnpm docs:generate` | TypeDoc HTML 生成 → `docs/generated/`       |

## 新規モジュール追加の手順

1. `src/<layer>/<module>.ts` にドメインロジックを実装
2. `src/<layer>/<module>.spec.ts` にテストを記述
3. 公開すべきものは `src/index.ts` から re-export
4. ディレクトリ構成・責務に変更があれば `readme.md` を更新（[/docs-sync](../../.claude/commands/docs-sync.md) SKILL 参照）
5. JSDoc を記述（[/jsdoc-style-guide](../../.claude/commands/jsdoc-style-guide.md) SKILL 参照）

## SKILL 一覧

`.claude/commands/` に作業手順を SKILL として定義している。`/foo` で呼び出し可能:

| SKILL                    | 用途                                  |
| ------------------------ | ------------------------------------- |
| `/claude-md-maintenance` | セッション終了時の CLAUDE.md 更新手順 |
| `/docs-sync`             | コード変更に追随したドキュメント更新  |
| `/jsdoc-style-guide`     | JSDoc 記述スタイル                    |
| `/package-audit`         | パッケージ設定の一貫性監査            |

## コミット前チェック

`pnpm check` をパスすることを必須とする。CI もこれを実行する。

## 関連ドキュメント

- [tech-stack.md](tech-stack.md) — 技術スタック・TS 設定の制約
- [testing.md](testing.md) — テスト方針
