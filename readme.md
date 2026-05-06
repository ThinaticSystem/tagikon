# Tagikon (滾滾)

オブジェクトをタグベースで管理する TypeScript ライブラリ。ファイルエクスプローラー・メモアプリ等のリソース管理機能に組み込み可能。

- **Object** = 主キー（文字列）で識別される任意のもの
- **Tag** = オブジェクトに付与される属性。タグからオブジェクトを検索する
- 拡張可能な3種のプラグイン: `IdProvider` / `StorageAdapter` / `Extension`

詳細は [docs/arch/overview.md](docs/arch/overview.md) を参照。

## Installation

モノレポ構成。各パッケージは独立して publish 可能。

```bash
# コア
pnpm add @tagikon/core

# IdProvider のいずれか
pnpm add @tagikon/id-provider-uuid

# StorageAdapter のいずれか
pnpm add @tagikon/storage-adapter-in-memory-map

# 必要に応じて Extension を追加
pnpm add @tagikon/extension-hierarchy
```

## Quick Start

```typescript
import { setupTagikon, tpc, taggedWithAny, tagsById } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";

const tagikon = setupTagikon({
	tagShape: {
		id: UUID_ID_PROVIDER,
		name: tpc.string(),
	},
	storageAdapter: new MapStorageAdapter(),
	extensions: [],
});

const urgent = await tagikon.addTag({ name: "urgent" });
await tagikon.tagObjects(urgent.id, [objectKey("memo-1")]);

const objects = await tagikon.findObjects(taggedWithAny(tagsById([urgent.id])));
```

## Documentation

| 種類                       | 場所                                                     |
| -------------------------- | -------------------------------------------------------- |
| アーキテクチャ概要         | [docs/arch/overview.md](docs/arch/overview.md)           |
| プラグインシステム         | [docs/arch/plugin-system.md](docs/arch/plugin-system.md) |
| セキュリティ設計           | [docs/arch/security.md](docs/arch/security.md)           |
| 開発者向けガイド           | [docs/contributing/](docs/contributing/)                 |
| LLM 作業履歴               | [docs/llm-work-log/](docs/llm-work-log/)                 |
| API リファレンス (TypeDoc) | `pnpm docs:generate` で生成 → `docs/generated/`          |

## Development

詳細な開発フロー・テスト方針は [docs/contributing/development.md](docs/contributing/development.md) / [docs/contributing/testing.md](docs/contributing/testing.md) を参照。

### Setup (VS Code)

1. [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers#_getting-started) を VS Code にセットアップ
2. このプロジェクトを Dev Container で開く

   <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> → `Dev Containers: Reopen in Container`

### Common Commands

| コマンド             | 説明                                     |
| -------------------- | ---------------------------------------- |
| `pnpm build`         | 全パッケージビルド                       |
| `pnpm test`          | Vitest watch モード                      |
| `pnpm test:run`      | Vitest 1回実行                           |
| `pnpm typecheck`     | tsgo 型チェック                          |
| `pnpm lint`          | oxlint                                   |
| `pnpm format`        | oxfmt フォーマット                       |
| `pnpm check`         | format:dry → lint → typecheck → test:run |
| `pnpm docs:generate` | TypeDoc HTML 生成                        |

その他のスクリプトは [`package.json`](./package.json) を参照。
