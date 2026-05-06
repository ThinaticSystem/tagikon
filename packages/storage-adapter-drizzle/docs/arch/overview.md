---
title: storage-adapter-drizzle
layer: adapter
type: architecture
tags: [storage-adapter, drizzle, sql, plugin]
---

# `@tagikon/storage-adapter-drizzle`

[Drizzle ORM](https://orm.drizzle.team/) 経由で SQLite / PostgreSQL に永続化する `StorageAdapter`。

## 公開シンボル

| シンボル                                                            | 役割                                         |
| ------------------------------------------------------------------- | -------------------------------------------- |
| `DrizzleStorageAdapter<TTag>`                                       | `StorageAdapterSetup<TTag>` 実装             |
| `createTagikonSqliteSchema(options?)`                               | SQLite 用 Drizzle テーブル定義ファクトリ     |
| `createTagikonPostgresqlSchema(options?)`                           | PostgreSQL 用 Drizzle テーブル定義ファクトリ |
| `TagikonSqliteSchema` / `TagikonPostgresqlSchema` / `TagikonSchema` | スキーマ型                                   |

## テーブル構成

3 テーブル構成（SQLite / PG 共通）:

| テーブル    | 役割                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| `tags`      | `id` (PK, string) + 各 `TagShape` プロパティが column として展開される                    |
| `relations` | `tagId` ↔ `objectKey` 関係。`(tagId, objectKey)` の複合 PK + objectKey 逆引きインデックス |
| `aux`       | extension 別の追加属性。`(extensionId, tagId)` 複合 PK + JSON 値                          |

`schema.dialect: "sqlite" | "postgres"` フィールドで方言を判別。

## ライフサイクル

```typescript
const adapter = new DrizzleStorageAdapter(db, schema);
const initialized = adapter.initialize(tagShape); // StorageAdapter<TTag>
```

`initialize` で IdProvider と per-property codec を一括注入。`#serializeTagProps` / `#deserializeTagProps` で codec を適用しつつ DB に書き込み・読み出す。

## セキュリティ

- **DB 読み取り時に core の `safeJsonParse` で `__proto__` 等の危険キーを除去** — プロトタイプ汚染対策
- **`getAuxStore(extensionId, auxCodec?)`** — `AuxCodec` を受け取って分岐（省略時は JSON）

## クエリコンパイラ

`query-compiler.ts` の `compileFindObjects` / `compileCountObjects` が `ObjectQuery` / `TagSelector` を SQL にコンパイル:

- `taggedWithAny` → `IN (tagId list)` ベースの `SELECT objectKey FROM relations WHERE tagId IN ...`
- `taggedWithAll` → 各 tagId について `INTERSECT`
- `and` / `or` / `not` → 集合演算 `INTERSECT` / `UNION` / `EXCEPT`
- `tagsWhere` → dialect-aware JSON アクセス（SQLite: `json_extract`、PG: `::jsonb ->>`）

`serializePropertyValue?` コールバックで述語値を保存形式にシリアライズ（bigint 等の対応）。実行は SQLite が `all()`、PostgreSQL が `execute()` の dialect 分岐付き。

## テスト

`@tagikon/core/testing` の `runStorageAdapterTests` を SQLite（better-sqlite3）/ PG（PGlite 等）の両方で実行。adapter 固有テストとして:

- bigint round-trip
- カスタム `AuxCodec`
- 数値述語（greater-than / less-than 等）
- `__proto__` プロトタイプ汚染防御

## 関連

- [`@tagikon/core` storage-adapter.md](../../../core/docs/arch/storage-adapter.md)
- [`@tagikon/core` query-language.md](../../../core/docs/arch/query-language.md) — クエリツリーの仕様
