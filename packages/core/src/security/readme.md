---
title: core/src/security
layer: core
type: reference
tags: [core, security, permission]
---

# `core/src/security`

Permission マニフェストと実行時ガードのエラー定義。

## 責務

- `Permission` リテラル型（`tag:read` / `tag:write` / `relation:read` / `relation:write`）の定義
- `PermissionManifest` 契約（Extension が宣言する権限セット）
- `PermissionMismatchError` / `PermissionDeniedError`

実行時ガードの本体（`createPermissionGuardedView`）は [factory.ts](../factory.ts) にある。

## ファイル一覧

| ファイル                       | 役割                                               |
| ------------------------------ | -------------------------------------------------- |
| [permission.ts](permission.ts) | `Permission` / `PermissionManifest` / 2 種のエラー |

## 関連ドキュメント

- [../../../../docs/arch/security.md](../../../../docs/arch/security.md)
- [../../docs/arch/errors.md](../../docs/arch/errors.md)
