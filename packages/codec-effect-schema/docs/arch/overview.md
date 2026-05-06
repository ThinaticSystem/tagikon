---
title: codec-effect-schema
layer: plugin
type: architecture
tags: [codec, effect-schema, plugin]
---

# `@tagikon/codec-effect-schema`

[Effect Schema](https://effect.website/docs/schema/introduction) から `TagPropertyCodec` を生成するブリッジ。

## 公開シンボル

| シンボル                   | 役割                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `fromEffectSchema(schema)` | Effect `Schema<TValue, TStored, never>` → `TagPropertyCodec<TValue, TStored>` |

## 振る舞い

- `Schema.encodeSync` を `serialize` として使用
- `Schema.decodeUnknownSync` を `deserialize` として使用
- decode エラーは Effect の `ParseError`（直接 `Schema.decodeUnknownSync` を呼んだ場合と同じ挙動）
- `R = never`（context 要件なし）の Schema のみ受け付ける（sync 操作の安全性のため）
- `makeCodec` 経由で `.optional()` チェーンを継承

## 利用例

```typescript
import { fromEffectSchema } from "@tagikon/codec-effect-schema";
import { Schema } from "effect";
import { setupTagikon, tpc } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

const tagikon = setupTagikon({
	tagShape: {
		id: UUID_ID_PROVIDER,
		name: fromEffectSchema(NonEmptyString),
		description: fromEffectSchema(Schema.String).optional(),
	},
	storageAdapter: myAdapter,
});
```

## 依存

`effect` >= 3.0.0 を peer dep として要求。

## 関連

- [`@tagikon/core` entities.md](../../../core/docs/arch/entities.md) — `TagPropertyCodec` / `tpc` / `makeCodec`
