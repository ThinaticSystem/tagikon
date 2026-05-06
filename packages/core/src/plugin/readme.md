---
title: core/src/plugin
layer: core
type: reference
tags: [core, plugin]
---

# `core/src/plugin`

プラグイン契約を定義するレイヤー。`IdProvider` / `StorageAdapter` / `Extension` の 3 種ごとにサブディレクトリを分ける。

## サブディレクトリ

| ディレクトリ                         | 役割                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- |
| [extension/](extension/)             | `Extension`・`ExtensionContext`・`use()`・`createExtension()`               |
| [id-provider/](id-provider/)         | `IdProvider<TId>` 契約                                                      |
| [storage-adapter/](storage-adapter/) | `StorageAdapter` / `StorageAdapterSetup` / `AuxStore` / Codec / `safe-json` |

## 関連ドキュメント

- [../../docs/arch/storage-adapter.md](../../docs/arch/storage-adapter.md)
- [../../../../../docs/arch/plugin-system.md](../../../../../docs/arch/plugin-system.md)
