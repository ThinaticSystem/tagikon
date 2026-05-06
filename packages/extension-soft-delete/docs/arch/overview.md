---
title: extension-soft-delete
layer: extension
type: architecture
tags: [extension, soft-delete]
---

# `@tagikon/extension-soft-delete`

タグの**論理削除**（soft delete）を提供する Extension。物理削除せず `isDeleted: true` フラグで隠蔽する。

## 公開シンボル

| シンボル                 | 役割                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `TagWithSoftDelete<TId>` | `Tag<TId>` を `isDeleted: boolean` で拡張する型（TagImplement 用） |
| `SOFT_DELETE_NS`         | namespace symbol                                                   |
| `SoftDeleteApi<TId>`     | 公開 API 型                                                        |
| `createSoftDelete()`     | Extension factory                                                  |

## カスタム API

`tagikon[SOFT_DELETE_NS]` 配下:

| API                     | 役割                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `softDeleteTag(id)`     | `isDeleted: true` を立てる。既に deleted なら `false` を返す |
| `restoreTag(id)`        | `isDeleted: false` に戻す                                    |
| `listSoftDeletedTags()` | 論理削除されたタグの一覧                                     |

## フック

| フック                     | 役割                           |
| -------------------------- | ------------------------------ |
| `addTag.transform`         | `isDeleted: false` を補完      |
| `listTags.transformOutput` | `isDeleted: true` のタグを除外 |

## 制限事項

現状 `listTags.transformOutput` で論理削除タグを除外するだけなので、`findObjects` / `countObjects` には反映されない（タグの ID で参照されるオブジェクトはそのまま返る）。`findObjects` フックで query を `and([q, not(taggedWithAny(tagsById([...softDeletedIds])))])` に書き換える対応が未実装（CLAUDE.md「未確定事項」に記載）。

## 必要 Permission

`tag:read`, `tag:write`

## 関連

- [`@tagikon/core` plugin-system.md](../../../../docs/arch/plugin-system.md) — Extension 一般
- [`@tagikon/core` hook-lifecycle.md](../../../core/docs/arch/hook-lifecycle.md) — フック仕様
