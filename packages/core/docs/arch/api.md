---
title: CoreApi 仕様
layer: core
type: api
tags: [core, api, setup]
---

# CoreApi 仕様

`setupTagikon({ tagShape, storageAdapter, extensions })` の戻り値が `CoreApi<TTag>` および登録された Extension のカスタム API を持つオブジェクト。

## エントリーポイント

```typescript
import { setupTagikon, tpc } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";

const tagikon = setupTagikon({
	tagShape: {
		id: UUID_ID_PROVIDER,
		name: tpc.string(),
	},
	storageAdapter: new MapStorageAdapter(),
	extensions: [
		/* ExtensionRegistration[] */
	],
});
```

`tagShape` 必須。`TTag` は `TagFromShape<TShape>` として推論される。`storageAdapter` は `StorageAdapterSetup<TTag>` 型を満たす必要があり、起動時に `storageAdapter.initialize(tagShape)` が呼ばれて以降のすべての操作で使われる `StorageAdapter<TTag>` が得られる。

## タグ操作

| API                  | 説明                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `addTag(attributes)` | タグ追加。`id` を除く全属性を渡す。Extension の transform フックで属性を補完・上書き可能   |
| `listTags()`         | タグのフラットリスト。階層構造は `extension-hierarchy` が提供                              |
| `editTag(id, patch)` | タグ情報の編集。追加属性は Extension が提供                                                |
| `deleteTag(id)`      | タグ削除。`true` = 削除した / `false` = 存在しなかった。Extension が削除時フックを利用可能 |

## オブジェクト操作

| API                                  | 説明                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `tagObjects(tagId, objectKeys[])`    | 複数オブジェクトへタグ付与                                                      |
| `untagObjects(tagId, objectKeys[])`  | 複数オブジェクトからタグ解除                                                    |
| `resetWithTags(objectKey, tagIds[])` | 指定セットでタグを上書き（差分自動計算）                                        |
| `findObjects(query, options?)`       | クエリに合致するオブジェクトキー（lexicographic sort）。`limit` / `offset` 対応 |
| `countObjects(query)`                | クエリに合致するオブジェクト件数                                                |

## 必須プロパティのバリデーション

`setupTagikon` は `tagShape` から必須プロパティ名を収集し、`addTag` の transform フック実行後（`createTag` 呼び出し直前）にランタイムバリデーションを実施する。これにより `extension-default-attributes` 等の transform フックでプロパティを補完する Extension とも互換性を維持しつつ、最終的に必須属性が欠落していれば `RequiredPropertyMissingError` を投げる。

## Extension のカスタム API

`use()` で root に登録された Extension は、namespace symbol 配下にカスタム API を公開できる。例えば `extension-hierarchy` の場合:

```typescript
const tagikon = setupTagikon({
    /* ... */,
    extensions: [use(createHierarchy(...))],
});

await tagikon[HIERARCHY_NS].listDescendants(tagId);
```

ネストされた子 Extension の API は外部からは見えず、親 Extension の `ctx.api[CHILD_NS]` 経由でのみアクセスできる。

## 関連ドキュメント

- [overview.md](overview.md) — Core パッケージ概要
- [hook-lifecycle.md](hook-lifecycle.md) — 各 API のフック実行モデル
- [query-language.md](query-language.md) — `findObjects` / `countObjects` のクエリ
