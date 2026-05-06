---
title: core/src/plugin/extension
layer: core
type: reference
tags: [core, extension, plugin]
---

# `core/src/plugin/extension`

`Extension` の型契約とランタイム登録ロジック。

## 責務

- `Extension<TTag, TNamespace, TApi, TAux, TChildrenApi>` インターフェース定義
- `ExtensionContext` および `ExtensionStorageView`（proxy view）の型と factory
- `createExtension(...)` factory（root / children 共通の構築 API）
- `use()` による Extension 登録 + Permission 照合 + namespace バリデーション

## ファイル一覧

| ファイル                 | 役割                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| [types.ts](types.ts)     | `Extension` / `ExtensionRegistration` / `ApiShape` / `ChildrenApiOf` / hook 入力型 |
| [context.ts](context.ts) | `ExtensionContext` / `ExtensionStorageView` / `createExtensionContext`             |
| [factory.ts](factory.ts) | `createExtension(...)` — `Object.freeze` 済み Extension を返す                     |
| [use.ts](use.ts)         | `use()` 登録関数 + Permission 照合 + namespace バリデーション                      |

## 関連ドキュメント

- [../../../../../../docs/arch/plugin-system.md](../../../../../../docs/arch/plugin-system.md)
- [../../../docs/arch/hook-lifecycle.md](../../../docs/arch/hook-lifecycle.md)
