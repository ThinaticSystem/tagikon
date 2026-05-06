---
title: クエリ言語
layer: core
type: api
tags: [core, query, find-objects]
---

# クエリ言語

`findObjects` / `countObjects` で使用するクエリ言語の仕様。`ObjectQuery<TId>` は **「タグ集合 (TagSelector)」と「オブジェクト集合 (ObjectQuery)」の二段階** で構成される。

## TagSelector

タグ集合を表現する。`findObjects` の入力として直接渡せず、`taggedWithAny` / `taggedWithAll` 経由で `ObjectQuery` に組み込まれる。

| ビルダー                   | 役割                                     |
| -------------------------- | ---------------------------------------- |
| `tagsById(ids)`            | 指定 ID のタグ集合                       |
| `tagsWhere(predicate)`     | 述語に合致するタグ集合                   |
| `intersectTags(selectors)` | 複数 TagSelector の積集合                |
| `unionTags(selectors)`     | 複数 TagSelector の和集合                |
| `complementTags(selector)` | 全タグから指定 selector を除外した補集合 |

## TagPredicate

`tagsWhere` の述語。タグ属性に対する条件を表現する。

| 述語ビルダー                       | match 種別              | 値の型    |
| ---------------------------------- | ----------------------- | --------- |
| `propertyEqual(prop, value)`       | `equal`                 | `unknown` |
| `propertyContains(prop, value)`    | `contains`              | `string`  |
| `propertyStartsWith(prop, value)`  | `starts-with`           | `string`  |
| `propertyEndsWith(prop, value)`    | `ends-with`             | `string`  |
| `propertyGreaterThan(prop, value)` | `greater-than`          | `number`  |
| `propertyLessThan(prop, value)`    | `less-than`             | `number`  |
| `propertyGreaterThanOrEqual(...)`  | `greater-than-or-equal` | `number`  |
| `propertyLessThanOrEqual(...)`     | `less-than-or-equal`    | `number`  |
| `predicateAnd(predicates)`         | -                       | -         |
| `predicateOr(predicates)`          | -                       | -         |
| `predicateNot(predicate)`          | -                       | -         |

## ObjectQuery

オブジェクト集合を表現する。`findObjects` / `countObjects` の入力。

| ビルダー                  | 役割                                          |
| ------------------------- | --------------------------------------------- |
| `taggedWithAny(selector)` | `selector` のいずれかのタグを持つオブジェクト |
| `taggedWithAll(selector)` | `selector` の全タグを持つオブジェクト         |
| `and(queries)`            | 複数 ObjectQuery の積集合                     |
| `or(queries)`             | 複数 ObjectQuery の和集合                     |
| `not(query)`              | `query` を満たさないオブジェクト              |

### `not` の universe

`not(q)` の universe（補集合の母集合）は **「少なくとも 1 つのタグが付与されたオブジェクトキー」**（リレーションテーブルに存在するキー）に限定される。Tagikon はタグ関係を持たない「裸のオブジェクト」の概念を持たないため、`not(q)` は untagged なオブジェクトを返さない。

## 評価モデル

`StorageAdapter` は `findObjects` / `countObjects` を必須実装する。実装の選択肢:

1. **ネイティブコンパイル**: SQL 等の検索言語にコンパイルする（`storage-adapter-drizzle` の `compileFindObjects` がこれ）
2. **インメモリ評価**: `evaluateObjectQueryInMemory` / `countObjectQueryInMemory` に delegate する（`storage-adapter-in-memory-map` がこれ）

評価器ヘルパーは `listTags` / `listTagObjects` のみで完結し、Adapter の他のメソッドを必要としない。

## 使用例

```typescript
// File explorer: ディレクトリ X 配下の全ファイル
const descendants = await tagikon[HIERARCHY_NS].listDescendants(dirTagId);
const files = await tagikon.findObjects(taggedWithAny(tagsById([dirTagId, ...descendants])));

// Memo: #urgent かつ #work
const memos = await tagikon.findObjects(taggedWithAll(tagsById([urgentId, workId])));

// 名前が "urgent" で始まるタグを持つオブジェクト
const result = await tagikon.findObjects(
	taggedWithAny<MyId>(tagsWhere(propertyStartsWith("name", "urgent"))),
);

// limit/offset によるページネーション（lexicographic sort）
const page2 = await tagikon.findObjects(query, { limit: 50, offset: 50 });
```

## 関連ドキュメント

- [api.md](api.md) — `findObjects` / `countObjects` の API 概要
- [storage-adapter.md](storage-adapter.md) — StorageAdapter での実装責務
