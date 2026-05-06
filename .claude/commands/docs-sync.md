# docs-sync

ソースコードの変更に合わせてドキュメント（`readme.md` / `docs/arch/*.md` / JSDoc）を最新に保つ。

## ドキュメント体系

コードの変更種別に応じて更新先が変わる。

| 変更の種類                                | 更新先                                            |
| ----------------------------------------- | ------------------------------------------------- |
| 関数・クラス・型のシグネチャ/仕様変更     | 該当ファイルの JSDoc コメント                     |
| モジュール追加・削除・責務変更            | 該当ディレクトリの `readme.md`                    |
| パッケージ全体の設計・データフロー変更    | `packages/<pkg>/docs/arch/overview.md`            |
| コアAPI仕様変更（タグ操作・クエリ言語等） | `packages/core/docs/arch/api.md` 等               |
| フック・エラー・エンティティ設計変更      | `packages/core/docs/arch/` 以下の該当ドキュメント |
| ライブラリ横断のアーキ・規約変更          | `docs/arch/overview.md` 等                        |
| 開発フロー・テスト方針・技術スタック変更  | `docs/contributing/` 以下の該当ドキュメント       |

## 手順

### 1. 変更内容の確認

```bash
git diff --name-only HEAD~1  # 直前コミットとの差分ファイル一覧
git diff HEAD~1              # 差分の詳細
```

変更ファイルを上記の表に当てはめ、更新が必要なドキュメントを特定する。

### 2. ドキュメントの更新

#### readme.md（ディレクトリ単位の責務説明）

ファイルが存在しない場合は新規作成する。必須セクションは以下:

```markdown
---
title: <ディレクトリ名>
layer: core | plugin | adapter | extension | tooling
type: reference
tags: []
---

# <ディレクトリ名>

## 責務

<1〜2段落でこのディレクトリが担う責務>

## ファイル一覧

| ファイル | 役割 |
| -------- | ---- |
| `foo.ts` | ...  |

## 依存関係

<上位/下位レイヤーとの関係。存在すれば Mermaid で図示>
```

#### docs/arch/\*.md（パッケージ・ライブラリ横断の設計）

ファイルが存在しない場合は新規作成する。必須の Front Matter:

```markdown
---
title: <ドキュメントタイトル>
layer: core | plugin | adapter | extension | tooling
type: architecture | api | guide | reference
tags: []
---
```

#### Mermaid 図の指針

| 説明対象     | diagram 種別      |
| ------------ | ----------------- |
| レイヤー構造 | `flowchart TD`    |
| データフロー | `sequenceDiagram` |
| クラス関係   | `classDiagram`    |
| 状態遷移     | `stateDiagram-v2` |

ascii art は使用しない。既存の ascii art を発見した場合は Mermaid に変換する。

#### JSDoc（関数・クラス・型の仕様）

JSDoc の記載方針については `/jsdoc-style-guide` SKILL を参照。

### 3. 更新後の確認

```bash
pnpm docs:generate  # TypeDoc が正常に生成できるか確認
```

TypeDoc がエラーなく完了することを確認する。`@link` 先が存在しない場合などにエラーが出ることがある。

## よくある確認漏れ

- `readme.md` の「ファイル一覧」テーブルに新規追加ファイルが含まれているか
- `docs/arch/` のドキュメントが削除されたクラス/関数を参照していないか
- Front Matter の `layer` / `type` が正しい値か（typo に注意）
- ドキュメント内のコードブロックが実際のシグネチャと一致しているか
