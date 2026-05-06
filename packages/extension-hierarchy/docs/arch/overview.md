---
title: extension-hierarchy
layer: extension
type: architecture
tags: [extension, hierarchy, tree]
---

# `@tagikon/extension-hierarchy`

タグに**ツリー構造**（親子関係）を提供する Extension。親子情報は AuxStore で管理されるため、コア `Tag` 型を変更しない。

## 公開シンボル

| シンボル                   | 役割                                      |
| -------------------------- | ----------------------------------------- |
| `HIERARCHY_NS`             | namespace symbol                          |
| `HierarchyApi<TId>`        | 公開 API 型                               |
| `HierarchyCycleError<TId>` | サイクル検出エラー（`TagikonError` 継承） |
| `createHierarchy()`        | Extension factory                         |

## カスタム API

`tagikon[HIERARCHY_NS]` 配下:

| API                      | 役割                                                  |
| ------------------------ | ----------------------------------------------------- |
| `moveTag(id, parentId)`  | タグの親を変更（`null` で root へ）。サイクル検出あり |
| `listChildren(parentId)` | 直接の子タグ ID リスト（`null` = root の子）          |
| `getParent(id)`          | 親タグ ID（root なら `null`）                         |
| `listAncestors(id)`      | root までの祖先 ID リスト                             |
| `listDescendants(id)`    | 子孫の全タグ ID リスト                                |

## データモデル

各タグの `AuxStore` エントリは `{ parentId: null | TId }` のみ。`null` は root を表す。サイクル検出は `moveTag` 時に祖先チェーンを `getParent` で辿って実施。

## フック

| フック                | 役割                                                         |
| --------------------- | ------------------------------------------------------------ |
| `addTag.after`        | 新規タグの aux に `{ parentId: null }` を put                |
| `removeTag.before` 系 | タグ削除時に子の親を引き上げる / 自身の aux エントリを削除等 |

詳細は [`packages/extension-hierarchy/src/index.ts`](../../src/index.ts) を参照。

## 必要 Permission

`tag:read`, `tag:write`

## エラー

| エラー                | 投げる場面                                 |
| --------------------- | ------------------------------------------ |
| `TagNotFoundError`    | 存在しない `tagId` を `moveTag` 等に渡した |
| `HierarchyCycleError` | `moveTag` で自分の子孫を親に指定した       |

## 関連

- [`@tagikon/core` plugin-system.md](../../../../docs/arch/plugin-system.md) — Extension 一般
- [`@tagikon/core` storage-adapter.md](../../../core/docs/arch/storage-adapter.md) — AuxStore の仕様
