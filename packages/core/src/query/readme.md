---
title: core/src/query
layer: core
type: reference
tags: [core, query]
---

# `core/src/query`

クエリ言語の型・ビルダー関数・インメモリ評価器。

## 責務

- `TagSelector<TId>` / `TagPredicate` / `ObjectQuery<TId>` / `FindObjectsOptions` の型定義
- 各ノードに対応する builder 関数（`tagsById` / `propertyEqual` / `taggedWithAny` 等）
- インメモリ評価器（`evaluateObjectQueryInMemory` / `countObjectQueryInMemory` / `evaluateTagSelectorAgainstTags`）

## ファイル一覧

| ファイル                     | 役割                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| [types.ts](types.ts)         | discriminated union による全ノード型                         |
| [builders.ts](builders.ts)   | builder 関数（TagSelector / TagPredicate / ObjectQuery）     |
| [evaluator.ts](evaluator.ts) | `listTags` / `listTagObjects` だけで完結するインメモリ評価器 |

## 関連ドキュメント

- [../../docs/arch/query-language.md](../../docs/arch/query-language.md) — 仕様の詳細
