---
title: core/src/plugin/storage-adapter
layer: core
type: reference
tags: [core, storage-adapter, codec, plugin]
---

# `core/src/plugin/storage-adapter`

StorageAdapter 契約・AuxStore・Codec・JSON safe parse・コントラクトテストユーティリティを置く。

## 責務

- `StorageAdapter` / `StorageAdapterSetup` のライフサイクル分離型契約
- `AuxStore` の KV 契約
- `TagPropertyCodec` / `OptionalTagPropertyCodec` / `tpc` 組み込みコーデック / `TagShape` / `TagFromShape` / `AuxCodec`
- `safeJsonParse` / `safeJsonParseValue` プロトタイプ汚染対策 JSON パーサー
- Adapter 実装の共通テストスイート (`@tagikon/core/testing` 経由で利用)

## ファイル一覧

| ファイル                     | 役割                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| [types.ts](types.ts)         | `StorageAdapter<TTag>` / `StorageAdapterSetup<TTag>` インターフェース               |
| [aux-store.ts](aux-store.ts) | `AuxStore<TKey, TData>` インターフェース                                            |
| [codec.ts](codec.ts)         | `TagPropertyCodec` / `tpc` / `makeCodec` / `TagShape` / `TagFromShape` / `AuxCodec` |
| [safe-json.ts](safe-json.ts) | `safeJsonParse` / `safeJsonParseValue`                                              |
| [testing.ts](testing.ts)     | `runStorageAdapterTests` 共通テストスイート (`@tagikon/core/testing`)               |

## 関連ドキュメント

- [../../../docs/arch/storage-adapter.md](../../../docs/arch/storage-adapter.md) — インターフェース仕様
- [../../../docs/arch/entities.md](../../../docs/arch/entities.md) — `TagShape` / `tpc`
- [../../../../../../docs/contributing/testing.md](../../../../../../docs/contributing/testing.md) — `runStorageAdapterTests` の使い方
