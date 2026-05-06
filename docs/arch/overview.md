---
title: アーキテクチャ概要
layer: core
type: architecture
tags: [overview, hook-runner, plugin]
---

# アーキテクチャ概要

Tagikon はオブジェクトをタグベースで管理する TypeScript ライブラリ。コアは「タグの CRUD」と「タグ ↔ オブジェクト関係の操作」のみを提供し、**タグの属性・階層・論理削除・ID 戦略・ストレージ等は全てプラグインで提供する**。

## レイヤー構造

```mermaid
flowchart TD
    User[ユーザーコード]
    Core[CoreApi & 子API<br/>setupTagikon の戻り値]
    HookRunner[Hook Runner<br/>5 フェーズ実行]
    Extensions[Extensions<br/>各々が独自 ctx を保持]
    Storage[StorageAdapter<br/>差し替え可能]
    Aux[AuxStore<br/>extension 別 KV]

    User --> Core
    Core --> HookRunner
    HookRunner --> Extensions
    HookRunner --> Storage
    Extensions -.aux.-> Aux
    Storage --> Aux
```

## オペレーションのライフサイクル

各 CoreApi 操作は以下5フェーズの Hook を順に実行する。`addTag` を例にしたシーケンス:

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant C as CoreApi
    participant R as Hook Runner
    participant E as Extensions
    participant S as StorageAdapter

    U->>C: addTag(input)
    C->>R: pipeline 開始
    R->>E: 1. beforeAddTag.tapRaw(ctx, input)
    R->>E: 2. beforeAddTag.transform(ctx, input)
    Note over R,E: 入力を変換（プラグイン登録順）
    R->>E: 3. beforeAddTag.tapTransformed(ctx, transformed)
    R->>S: createTag(transformed)
    S-->>R: tag
    R->>E: 4. transformOutput(ctx, tag)
    R->>E: 5. afterAddTag(ctx, finalTag)
    R-->>C: finalTag
    C-->>U: finalTag
```

詳細は [packages/core/docs/arch/hook-lifecycle.md](../../packages/core/docs/arch/hook-lifecycle.md) を参照（フェーズ5b で作成予定）。

## プラグイン3種

| 種別             | 役割                                                       |
| ---------------- | ---------------------------------------------------------- |
| `IdProvider`     | タグID生成 + シリアライズ/デシリアライズ                   |
| `StorageAdapter` | タグ・関係・AuxStore の永続化                              |
| `Extension`      | フック処理・カスタム API・Tag への属性追加（TagImplement） |

詳しくは [plugin-system.md](plugin-system.md) を参照。

## モノレポ構成

| パッケージ                               | 役割                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| `@tagikon/core`                          | コア API・Hook Runner・クエリ言語・型定義              |
| `@tagikon/utils`                         | 汎用ユーティリティ（memoize・safeJsonParse・Set 演算） |
| `@tagikon/id-provider-string`            | 文字列 ID プロバイダー                                 |
| `@tagikon/id-provider-uuid`              | UUID ID プロバイダー                                   |
| `@tagikon/storage-adapter-in-memory-map` | インメモリ参照実装                                     |
| `@tagikon/storage-adapter-drizzle`       | Drizzle ORM 経由の SQLite/PostgreSQL アダプター        |
| `@tagikon/extension-soft-delete`         | 論理削除タグ                                           |
| `@tagikon/extension-default-attributes`  | addTag 時の属性デフォルト補完                          |
| `@tagikon/extension-hierarchy`           | タグ階層（ツリー）                                     |
| `@tagikon/codec-effect-schema`           | Effect Schema からの TagPropertyCodec ブリッジ         |

各パッケージの詳細は `packages/<pkg>/docs/arch/overview.md`（フェーズ5で作成）を参照。

## 関連ドキュメント

- [plugin-system.md](plugin-system.md) — プラグイン3種の責務と相互作用
- [security.md](security.md) — Permission・隔離設計
- [../contributing/tech-stack.md](../contributing/tech-stack.md) — 技術スタックと TS 設定の制約
