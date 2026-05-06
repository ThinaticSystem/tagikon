---
title: core/src
layer: core
type: reference
tags: [core, source]
---

# `@tagikon/core/src`

ライブラリのコアエントリーポイント。`setupTagikon` の実装と全公開シンボルの定義を含む。

## 責務

- `Tag<TId>` 等の最小エンティティ
- `setupTagikon` ファクトリと `CoreApi` 契約
- Hook Runner と 5 フェーズライフサイクル
- プラグイン契約（`IdProvider` / `StorageAdapter` / `Extension`）
- クエリ言語の型・ビルダー・評価器
- Permission マニフェストと実行時ガード

## ファイル一覧

| ファイル                 | 役割                                             |
| ------------------------ | ------------------------------------------------ |
| [index.ts](index.ts)     | 公開エントリーポイント（re-export のみ）         |
| [factory.ts](factory.ts) | `setupTagikon` 実装と `CoreApi` インターフェース |
| [core/](core/)           | エンティティ・branded type・エラー               |
| [hook/](hook/)           | Hook Runner と型定義                             |
| [plugin/](plugin/)       | プラグイン契約                                   |
| [query/](query/)         | クエリ言語                                       |
| [security/](security/)   | Permission                                       |

## 関連ドキュメント

- [../docs/arch/overview.md](../docs/arch/overview.md) — Core 設計概要
- [../docs/arch/api.md](../docs/arch/api.md) — `setupTagikon` / `CoreApi` 仕様
