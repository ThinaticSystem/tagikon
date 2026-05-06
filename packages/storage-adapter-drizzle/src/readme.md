---
title: storage-adapter-drizzle/src
layer: adapter
type: reference
tags: [storage-adapter, drizzle, sql]
---

# `@tagikon/storage-adapter-drizzle/src`

Drizzle ORM 経由で SQLite / PostgreSQL に永続化する `StorageAdapter`。

## ファイル一覧

| ファイル                               | 役割                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [index.ts](index.ts)                   | 公開エントリーポイント                                                                          |
| [adapter.ts](adapter.ts)               | `DrizzleStorageAdapter<TTag>`。`initialize(tagShape)` で IdProvider + per-property codec を注入 |
| [schema.ts](schema.ts)                 | `createTagikonSqliteSchema` / `createTagikonPostgresqlSchema` Drizzle テーブルファクトリ        |
| [query-compiler.ts](query-compiler.ts) | `compileFindObjects` / `compileCountObjects` — `ObjectQuery` → SQL コンパイラ                   |

## 関連

- [../docs/arch/overview.md](../docs/arch/overview.md)
- [../../core/docs/arch/storage-adapter.md](../../core/docs/arch/storage-adapter.md)
- [../../core/docs/arch/query-language.md](../../core/docs/arch/query-language.md)
