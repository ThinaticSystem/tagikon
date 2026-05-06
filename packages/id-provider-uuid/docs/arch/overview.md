---
title: id-provider-uuid
layer: plugin
type: architecture
tags: [id-provider, uuid, plugin]
---

# `@tagikon/id-provider-uuid`

UUID v4 文字列を ID として発行するデフォルト `IdProvider`。

## 公開シンボル

| シンボル           | 役割                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `Uuid`             | `string` の branded type（`unique symbol` で `uuid` brand）             |
| `uuid(raw)`        | 任意の文字列を `Uuid` にキャストするファクトリ                          |
| `UUID_ID_PROVIDER` | `IdProvider<Uuid>` のデフォルトインスタンス。`crypto.randomUUID()` 使用 |

## 実装

`@tagikon/id-provider-string` の `stringIdProvider` を `crypto.randomUUID()` でラップしただけの薄い実装。

```typescript
export const UUID_ID_PROVIDER: IdProvider<Uuid> = stringIdProvider(() => uuid(crypto.randomUUID()));
```

`crypto` グローバルに依存（Node 19+ / 主要ブラウザ）。

## 利用例

```typescript
import { setupTagikon, tpc } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";

const tagikon = setupTagikon({
	tagShape: { id: UUID_ID_PROVIDER, name: tpc.string() },
	storageAdapter: myAdapter,
});
```

## 関連

- [`@tagikon/id-provider-string`](../../../id-provider-string/) — 文字列 ID 全般のベース
- [`@tagikon/core` IdProvider](../../../core/docs/arch/entities.md)
