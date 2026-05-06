---
title: 技術スタック
layer: tooling
type: guide
tags: [typescript, build, lint]
---

# 技術スタック

## ツール一覧

| ツール                                    | 用途                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| TypeScript (ESNext, `erasableSyntaxOnly`) | 言語                                                                             |
| `@typescript/native-preview` (`tsgo`)     | 型チェック (`pnpm typecheck`)                                                    |
| `typescript`                              | DTS 生成専用（`tsdown` の `rolldown-plugin-dts` が要求。型チェックには使わない） |
| `tsdown`                                  | バンドル (`pnpm build`)                                                          |
| Vitest                                    | テスト (`pnpm test`)                                                             |
| oxlint + oxfmt                            | Lint / フォーマット                                                              |
| TypeDoc                                   | API リファレンス HTML 生成 (`pnpm docs:generate`)                                |
| pnpm (workspace)                          | モノレポ管理                                                                     |

## TypeScript 設定の制約

すべてのパッケージは `@tagikon/tsconfig/base.json` を extends する。以下の制約が全コードに適用される。

| 設定                               | 意味と影響                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `erasableSyntaxOnly: true`         | enum・namespace・パラメータプロパティ禁止。代替: `const` オブジェクト + `satisfies`、または branded type |
| `verbatimModuleSyntax: true`       | 型のみインポートは必ず `import type`                                                                     |
| `noUncheckedIndexedAccess: true`   | 配列・オブジェクトのインデックスアクセスは `T \| undefined`                                              |
| `exactOptionalPropertyTypes: true` | `prop?: T` に `undefined` を明示代入不可                                                                 |
| `allowImportingTsExtensions: true` | 相対インポートは `.ts` 拡張子を明示                                                                      |

## モノレポ構造

```
packages/
  core/                          # @tagikon/core
  id-provider-string/            # @tagikon/id-provider-string
  id-provider-uuid/              # @tagikon/id-provider-uuid
  storage-adapter-in-memory-map/ # @tagikon/storage-adapter-in-memory-map
  storage-adapter-drizzle/       # @tagikon/storage-adapter-drizzle
  extension-soft-delete/         # @tagikon/extension-soft-delete
  extension-default-attributes/  # @tagikon/extension-default-attributes
  extension-hierarchy/           # @tagikon/extension-hierarchy
  codec-effect-schema/           # @tagikon/codec-effect-schema
  tsconfig/                      # @tagikon/tsconfig（共有 tsconfig ベース）
```

各パッケージは `workspace:*` で相互参照する。`packages/tsconfig/base.json` をパッケージ名経由で `extends` することで pnpm symlink 越しの解決バグを回避している。

## 関連ドキュメント

- [development.md](development.md) — 開発フロー・コマンド一覧
- [testing.md](testing.md) — テスト方針
- [../arch/overview.md](../arch/overview.md) — アーキテクチャ概要
