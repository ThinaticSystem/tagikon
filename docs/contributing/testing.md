---
title: テスト方針
layer: tooling
type: guide
tags: [testing, vitest]
---

# テスト方針

## 基本原則

- 各モジュールに `<module>.spec.ts` を **同階層** に配置する
- テストランナーは [Vitest](https://vitest.dev/)
- テストのグループ化は `suite` / `test` を使う（`describe` / `it` は禁止）
- インメモリ Storage Adapter を使った**統合テスト**を主軸とする。外部 DB のモック化は禁止

## 実行コマンド

| コマンド        | 説明                                     |
| --------------- | ---------------------------------------- |
| `pnpm test`     | watch モードで実行                       |
| `pnpm test:run` | 1回実行（CI 想定）                       |
| `pnpm check`    | format:dry → lint → typecheck → test:run |

## テストの粒度

| カテゴリ                    | 対象例                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| ユニットテスト              | builder 関数・エラークラス・safeJson 等の純粋関数                              |
| 統合テスト                  | `setupTagikon` 経由の フック動作・Permission 制限・nested extensions・aux 隔離 |
| StorageAdapter コントラクト | `runStorageAdapterTests`（`@tagikon/core/testing`）を全 Adapter で実行         |

## StorageAdapter コントラクトテスト

各 `StorageAdapter` 実装は `runStorageAdapterTests` を使って共通テストスイートを通す。これにより全 CRUD・リレーション・AuxStore・findObjects/countObjects・各 TagSelector/ObjectQuery 組み合わせがカバーされる。

```typescript
import { runStorageAdapterTests } from "@tagikon/core/testing";
import { suite } from "vitest";

suite("MyAdapter", () => {
	runStorageAdapterTests({
		createAdapter: () => new MyAdapter(),
	});
});
```

Adapter 固有のテスト（bigint round-trip・カスタム `AuxCodec`・プロトタイプ汚染防御等）は別 suite で追加する。

## エッジケース・パラメタライズドテスト

happy path のみではなく、以下を網羅すること:

- エラーケース（存在しないタグ ID・境界値・空配列等）
- Permission 違反・ライフサイクル違反
- パラメタライズドテストには `test.each` を積極活用する

## 関連ドキュメント

- [development.md](development.md) — 開発フロー
- [tech-stack.md](tech-stack.md) — Vitest を含む技術スタック
