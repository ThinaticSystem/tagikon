---
title: Core パッケージ概要
layer: core
type: architecture
tags: [core, overview]
---

# `@tagikon/core` 概要

ライブラリのコアエントリーポイント。`setupTagikon` がここで提供され、最小の `Tag<TId>` エンティティと Hook Runner・クエリ言語・型契約を提供する。

## 公開シンボル

`packages/core/src/index.ts` から re-export されているもののみ:

| 種類           | 名称                                                                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory        | `setupTagikon`, `CoreApi`, `SetupTagikonOptions`                                                                                                                                                                                                                                                                           |
| エンティティ   | `Tag`, `IdOf`, `objectKey`, `ObjectKey`                                                                                                                                                                                                                                                                                    |
| プラグイン基盤 | `createExtension`, `createExtensionContext`, `use`, `Extension`, `ExtensionContext`, `IdProvider`, `StorageAdapter`, `StorageAdapterSetup`, `AuxStore`, `AuxCodec`, `TagShape`, `TagPropertyCodec`, `OptionalTagPropertyCodec`, `TagFromShape`, `tpc`, `makeCodec`, `JsonPrimitive`, `safeJsonParse`, `safeJsonParseValue` |
| フック         | `HookPhases`, `TapRawFn`, `TransformFn`, `TapTransformedFn`, `TransformOutputFn`, `AfterFn`                                                                                                                                                                                                                                |
| クエリ言語     | `tagsById`, `tagsWhere`, `intersectTags`, `unionTags`, `complementTags`, `taggedWithAny`, `taggedWithAll`, `and`, `or`, `not`, `propertyEqual` ほか述語ビルダー一式                                                                                                                                                        |
| クエリ評価     | `evaluateObjectQueryInMemory`, `countObjectQueryInMemory`, `evaluateTagSelectorAgainstTags`                                                                                                                                                                                                                                |
| エラー         | `TagikonError`, `ExtensionError`, `TagNotFoundError`, `TagAlreadyExistsError`, `ObjectNotTaggedError`, `RequiredPropertyMissingError`, `StorageAdapterAlreadyInitializedError`, `StorageAdapterNotInitializedError`, `IllegalExtensionDefinitionError`, `NamespaceNotFoundError`                                           |
| セキュリティ   | `Permission`, `PermissionManifest`, `PermissionMismatchError`, `PermissionDeniedError`                                                                                                                                                                                                                                     |

## ディレクトリ構造

| ディレクトリ                           | 責務                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| [src/core/](../../src/core)            | エンティティ・branded type・エラー（[entities.md](entities.md) / [errors.md](errors.md)） |
| [src/factory.ts](../../src/factory.ts) | `setupTagikon` 実装と `CoreApi` 公開（[api.md](api.md)）                                  |
| [src/hook/](../../src/hook)            | Hook Runner と型定義（[hook-lifecycle.md](hook-lifecycle.md)）                            |
| [src/plugin/](../../src/plugin)        | プラグイン契約（[storage-adapter.md](storage-adapter.md) ほか）                           |
| [src/query/](../../src/query)          | クエリ言語の型・ビルダー・評価器（[query-language.md](query-language.md)）                |
| [src/security/](../../src/security)    | Permission マニフェスト・実行時ガード                                                     |

## 関連ドキュメント

- [api.md](api.md) — CoreApi 仕様（`setupTagikon` の戻り値）
- [hook-lifecycle.md](hook-lifecycle.md) — 5 フェーズの Hook 実行モデル
- [query-language.md](query-language.md) — TagSelector / ObjectQuery / 述語
- [entities.md](entities.md) — `Tag<TId>` と branded types
- [errors.md](errors.md) — エラー階層
- [storage-adapter.md](storage-adapter.md) — StorageAdapter インターフェース仕様
- [../../../../docs/arch/overview.md](../../../../docs/arch/overview.md) — ライブラリ横断のアーキテクチャ
