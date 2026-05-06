---
title: extension-default-attributes
layer: extension
type: architecture
tags: [extension, default-attributes]
---

# `@tagikon/extension-default-attributes`

`addTag` 時に不在の属性をプロバイダー関数で補完する組み込み Extension。

## 公開シンボル

| シンボル                             | 役割                                         |
| ------------------------------------ | -------------------------------------------- |
| `AttributeProviders<TTag>`           | プロバイダー定義型 `{ [属性名]?: () => 値 }` |
| `createDefaultAttributes(providers)` | Extension factory                            |

## 振る舞い

`addTag.transform` フックで、入力に**含まれない**属性のみプロバイダー関数の戻り値で埋める。既に値がある属性は触らない。

```typescript
import { createDefaultAttributes } from "@tagikon/extension-default-attributes";

const ext = createDefaultAttributes<MyTag>({
	createdAt: () => new Date(),
	color: () => "gray",
});
```

`tagShape` 側で `tpc.string().optional()` 等にしておけば、ユーザーは省略できる属性を Extension 側で補完できる。

## カスタム API

なし（hooks のみの Extension）。`namespace` も持たないため `use()` には登録名なしで使える。

## 必要 Permission

なし（`ctx.storage` を読まない）。

## 関連

- [`@tagikon/core` hook-lifecycle.md](../../../core/docs/arch/hook-lifecycle.md) — `transform` フェーズの仕様
