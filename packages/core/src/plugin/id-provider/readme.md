---
title: core/src/plugin/id-provider
layer: core
type: reference
tags: [core, id-provider, plugin]
---

# `core/src/plugin/id-provider`

`IdProvider<TId>` の型契約のみを置く（実装は別パッケージ）。

## 責務

- タグ ID の generate / serialize / deserialize 契約を `TagPropertyCodec<TId, string>` の派生として定義
- 保存先が常に `string` であること（DB 主キー列で扱える）を型レベルで保証

## ファイル一覧

| ファイル             | 役割                               |
| -------------------- | ---------------------------------- |
| [types.ts](types.ts) | `IdProvider<TId>` インターフェース |

## 実装

- [`@tagikon/id-provider-string`](../../../../../id-provider-string/) — 文字列 ID 一般
- [`@tagikon/id-provider-uuid`](../../../../../id-provider-uuid/) — UUID v4 デフォルト

## 関連ドキュメント

- [../../../docs/arch/entities.md](../../../docs/arch/entities.md)
