---
title: storage-adapter-in-memory-map
layer: adapter
type: architecture
tags: [storage-adapter, in-memory, plugin]
---

# `@tagikon/storage-adapter-in-memory-map`

`Map` ベースのインメモリ参照実装。テスト・プロトタイピング・小規模ユースケース用。

## 公開シンボル

| シンボル                  | 役割                                   |
| ------------------------- | -------------------------------------- |
| `MapStorageAdapter<TTag>` | `StorageAdapterSetup<TTag>` 実装クラス |

## データ構造

```typescript
#tags: Map<string /* serialized tagId */, TTag>
#tagToObjects: Map<string /* tagId */, Set<string /* objectKey */>>
#objectToTags: Map<string /* objectKey */, Set<string /* tagId */>>
#auxByExtension: Map<symbol /* extensionId */, Map<string, unknown>>
```

タグ ID は `IdProvider.serialize()` 経由で文字列化してから Map のキーに使う。双方向の `tagId ↔ objectKey` 関係を冗長に持ち、`listTagObjects` / `listObjectTags` を O(1) で返す。

## 設計上の決定事項

- **コンストラクタ引数なし**。`initialize(tagShape)` で IdProvider を受け取り `StorageAdapter<TTag>` を返す
- **per-property codec は no-op**。インメモリは値を生のまま保持するためシリアライズ不要
- **`findObjects` / `countObjects` は core の評価器に delegate**（`evaluateObjectQueryInMemory` / `countObjectQueryInMemory`）
- **`AuxStore` も Map ベース**。同じ `extensionId` で複数回呼んでも同一インスタンスを返すため wrapper をキャッシュ

## ライフサイクル

`initialize` 二重呼び出しで `StorageAdapterAlreadyInitializedError`。`initialize` 前のデータ操作は `StorageAdapterNotInitializedError`。

## 関連

- [`@tagikon/core` storage-adapter.md](../../../core/docs/arch/storage-adapter.md) — インターフェース仕様
- [`@tagikon/storage-adapter-drizzle`](../../../storage-adapter-drizzle/) — SQL 実装の参考
