---
title: id-provider-string
layer: plugin
type: architecture
tags: [id-provider, plugin]
---

# `@tagikon/id-provider-string`

文字列をそのまま ID として使う最小の `IdProvider` ヘルパー。

## 公開シンボル

| シンボル                | 役割                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `stringIdProvider<TId>` | `() => TId` から `IdProvider<TId>` を生成するファクトリ関数 |

## 振る舞い

- `serialize` / `deserialize` は identity（`TId extends string` を要求）
- `generate` は呼び出し側が指定（`crypto.randomUUID()` ラッパー等）
- `@tagikon/id-provider-uuid` の内部実装としても使用される

```typescript
import { stringIdProvider } from "@tagikon/id-provider-string";

const sequentialIds = stringIdProvider(() => `id-${counter++}`);
```

## 関連

- [`@tagikon/id-provider-uuid`](../../../id-provider-uuid/) — UUID 版（このパッケージのラッパー）
- [`@tagikon/core` IdProvider](../../../core/docs/arch/entities.md) — `IdProvider` 契約
