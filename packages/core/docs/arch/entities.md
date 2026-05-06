---
title: コアエンティティ設計
layer: core
type: architecture
tags: [core, entity, tag, branded-type]
---

# コアエンティティ設計

`@tagikon/core` が提供するエンティティと branded types。

## Tag（最小エンティティ）

`Tag<TId>` は `id` のみを持つ最小インターフェース。`name` を含むすべての属性は **Extension（TagImplement 用途）または利用者が intersection で提供する**。

```typescript
interface Tag<TId = unknown> {
	readonly id: TId;
}

type IdOf<TTag extends Tag> = TTag extends Tag<infer TId> ? TId : never;
```

- `TId` のデフォルトは `unknown`（最大寛容）
- 制約サイトは `T extends Tag` と書けば十分。具体的なコードは `Tag<TagId>` を明示する
- `TTag extends Tag` のジェネリクス伝播で `StorageAdapter` / `CoreApi` の各メソッドが正しく型付けされる

### TagImplement パターン

```typescript
type MyTag = Tag<string> & {
	readonly name: string;
	readonly kind: "user" | "system";
	readonly description: string;
};

const tagikon = setupTagikon<MyTag>({
	/* ... */
});
await tagikon.addTag({ name: "foo", kind: "user", description: "" });
```

`tagShape` を渡すと `TagFromShape<TShape>` で `MyTag` 相当の型が推論される（明示する必要なし）:

```typescript
const tagikon = setupTagikon({
	tagShape: {
		id: UUID_ID_PROVIDER,
		name: tpc.string(),
		description: tpc.string().optional(),
	},
	storageAdapter: new MapStorageAdapter(),
});
// tagikon は CoreApi<{ id: Uuid; name: string; description?: string }> 相当
```

## ObjectKey（Branded Type）

オブジェクト識別子。`unique symbol` で branded した `string` 型。

```typescript
import { objectKey, type ObjectKey } from "@tagikon/core";

const key: ObjectKey = objectKey("memo-1");
```

タグ ID（`IdProvider` 由来の `string`）との混同を防ぐため `string` から直接代入できない。

## Tag Kind（プラグイン提供）

`kind` はコア `Tag` から除外された。`packages/core/src/core/tag-kind.ts` に `TAG_KIND` / `TagKind` 型定義は残っているが**コア API からは公開されていない**。プラグインが独自に提供する属性として扱う。

## TagShape と TagPropertyCodec

`tagShape` は `id: IdProvider<...>` と各プロパティの `TagPropertyCodec` をマップしたもの。Codec は serialize/deserialize を提供し、StorageAdapter（特に DB 系）が値をシリアライズする際に使用する。

```typescript
import { tpc, makeCodec } from "@tagikon/core";

// 組み込みコーデック
tpc.string(); // string ⇄ string
tpc.number(); // number ⇄ string
tpc.boolean(); // boolean ⇄ string
tpc.bigint(); // bigint ⇄ string
tpc.json(); // object ⇄ string (JSON, prototype-pollution 対策済み)

// .optional() チェーン: TagFromShape で optional プロパティとして推論される
tpc.string().optional();

// カスタム Codec
makeCodec<Date, string>({
	serialize: (d) => d.toISOString(),
	deserialize: (s) => new Date(s),
});
```

`@tagikon/codec-effect-schema` の `fromEffectSchema` を使えば Effect Schema 経由でも codec を生成できる。

## 関連ドキュメント

- [errors.md](errors.md) — `TagikonError` 階層
- [storage-adapter.md](storage-adapter.md) — `TagShape` と `StorageAdapter` の関係
- [api.md](api.md) — `setupTagikon` / `CoreApi`
