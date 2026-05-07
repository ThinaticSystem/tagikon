# Tagikon — CLAUDE.md

## プロジェクト概要

**Tagikon（滾滾）** — オブジェクトをタグベースで管理する TypeScript ライブラリ。

- オブジェクト = 主キーを持つ任意のもの（文字列キーで識別）
- タグでオブジェクトを検索する
- ファイルエクスプローラー・メモアプリなどのユーザーリソース管理機能に組み込み可能
- `IdProvider` / `StorageAdapter` / `Extension` の3種で拡張可能

---

## ドキュメント体系

設計・仕様・操作手順は CLAUDE.md には書かない。下記ポインタを使い分けること。

| 種類                     | 場所                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 全体アーキテクチャ       | [docs/arch/overview.md](docs/arch/overview.md)                                                                       |
| プラグインシステム       | [docs/arch/plugin-system.md](docs/arch/plugin-system.md)                                                             |
| セキュリティ設計         | [docs/arch/security.md](docs/arch/security.md)                                                                       |
| 開発者向けガイド         | [docs/contributing/](docs/contributing/) (`tech-stack` / `testing` / `development`)                                  |
| コア API・クエリ・フック | [packages/core/docs/arch/](packages/core/docs/arch/)                                                                 |
| 各プラグインパッケージ   | [packages/<pkg>/docs/arch/overview.md](packages/)                                                                    |
| LLM 作業履歴             | [docs/llm-work-log/](docs/llm-work-log/)                                                                             |
| 運用 SKILL               | [.claude/commands/](.claude/commands/) (`/claude-md-maintenance` `/docs-sync` `/jsdoc-style-guide` `/package-audit`) |

セッション終了時の手順・行動原則は `/claude-md-maintenance` SKILL に集約済み。

---

## TypeScript 設定の制約

- `erasableSyntaxOnly: true` — enum・namespace・パラメータプロパティ禁止。代替: `const` オブジェクト + `satisfies`、または branded type
- `verbatimModuleSyntax: true` — 型のみインポートは必ず `import type`
- `noUncheckedIndexedAccess: true` — 配列・オブジェクトのインデックスアクセスは `T | undefined`
- `exactOptionalPropertyTypes: true` — `prop?: T` に `undefined` を明示代入不可
- `allowImportingTsExtensions: true` — 相対インポートは `.ts` 拡張子を明示

---

## コーディング規約

### 基本方針

- コメントは WHY が非自明な場合のみ。WHAT を説明するコメント禁止
- 型安全を最優先。`any` / `unknown` を不必要に使わない（型制約には `unknown`、条件型推論でも `any` 禁止）
- 副作用のない純粋関数を基本とし、副作用は Storage Adapter に閉じ込める
- エラーは必ず `TagikonError`（`packages/core/src/core/errors.ts`）を継承する。`Error` の直接継承禁止（文字列スロー禁止）
- TypeScript スタイルの private アクセサーは禁止。ECMAScript の `#`-prefix アクセサーを使用する
- アクロニムの使用は原則禁止（例外的に `API` / `ID` / `URL` など、既存の概念の場合のみ許可）。コールバック引数の命名など即時的な記述でも禁止

### null / undefined の使い分け

- **`null`** — 値が存在しないことを明示的に表す返り値（例: `getTag()` がヒットしなかった場合）
- **`undefined`** — デフォルト値・未指定のセマンティクスのみ（省略可能な引数 `options?: Foo` など）
- 返り値に `undefined` を使わない。「ない」を表すときは常に `null`

### 型定義の順序

nullable / undefinedable な型は修飾子を前置する。

```typescript
// Good
Promise<null | T>;

// Bad
Promise<T | null>;
```

### 命名規則

- ファイル名: `kebab-case.ext`
- 型・クラス・インターフェース: `PascalCase`
- 関数・変数: `camelCase`
- 定数オブジェクト（enum の代替）: `SCREAMING_SNAKE_CASE`
- プライベートなモジュール内部シンボルには `_` プレフィックスを付けない（ファイルスコープで管理）
- **`export` はファイル末尾にまとめて書かない。宣言にインラインで付ける**（`export interface Foo`、`export function bar`）。末尾の `export { ... }` 禁止。`src/index.ts` の re-export は例外
- **複数のものを返す API は `list` プレフィックス**（`listTags()`, `listObjectTags()` など）。`get` は単一取得に限定

### 型パラメータの命名

`T` プレフィックス + 略さない具体的な名前。`T`・`R`・`U` など 1 文字の型パラメータは禁止。

```typescript
// Good
type FunctionType<TInput, TOutput = TInput> = ...

// Bad
type FunctionType<T, R = T> = ...
```

### ジェネリクス制約でのデフォルト引数の活用

```typescript
// Good — デフォルトを活用。Tag の型パラメータが変わっても制約サイトは変更不要
function foo<T extends Tag>(...): ...

// Bad — 具体的なスーパータイプを繰り返す
function foo<T extends Tag<string, unknown>>(...): ...
```

### 関数は可能な限りアロー関数で宣言する

`this` を使う必要やジェネレーターを返す場合のみ例外的に `function` 宣言を許可する。

```typescript
// Good
const myFunction = (arg: Type): ReturnType => { ... };
```

### 配列を受け取る関数の引数は readonly

```typescript
// Good
pickItem<TElement>(items: readonly TElement[], index: number): null | TElement;
```

配列を返す場合（`listTags(): Promise<T[]>`）は readonly 不要。

### ファイル内の凝集

同一概念に属する宣言は物理的にまとめて配置する。branded type を例に:

```typescript
// Good — brand symbol・型・factory が 1 グループ
declare const tagIdBrand: unique symbol;
export type TagId = string & { readonly [tagIdBrand]: never };
export const tagId = (raw: string): TagId => { ... };

// Bad — 全 symbol をまとめ、全型をまとめ、全 factory をまとめる（概念が分断される）
```

### モジュール設計

- 1 ファイル 1 責務。循環参照を避けるため依存は常に上位→下位方向
- `src/index.ts` はライブラリの公開エントリーポイント（re-export のみ）
- 内部モジュールは `src/internal/` 以下に配置し、公開 API から隠蔽する

### イテレーション実装

`filter/map/reduce` などの組み込みメソッドを複数段使う場合は、パフォーマンスのために Iterator Helpers を使用することを検討する（例: `array.filter(...).map(...)` → `array.values().filter(...).map(...).toArray()` など）。

---

## 実装状況

ファイル単位の完了一覧は [docs/llm-work-log/completed-implementations.md](docs/llm-work-log/completed-implementations.md)。新規完了項目は同ファイルに追記する（手順は `/docs-sync` SKILL）。

### 未実装（優先度順）

### 未確定事項（設計中）

- **プラグインのマイグレーション機構** — 例えば階層プラグインの実装を変えるときなど、既存のユーザーデータを新しい実装に移行するための仕組み。マイグレーションのための API を提供
- **論理削除タグ経由のオブジェクトを `findObjects` 結果から自動除外** — `extension-soft-delete` は現状 `listTags.transformOutput` で論理削除タグを除外するだけなので、`findObjects` には反映されない。`findObjects` フックで query を `and([q, not(taggedWithAny(tagsById([...softDeletedIds])))])` に書き換える

  `findObjects` で論理削除タグオブジェクトが除外されるため、論理削除されたオブジェクトのみを取得する追加 API（例: `findSoftDeletedObjects`）も提供する。

- **`TagPredicate` の `property` で string 以外の型を扱う** — 現状は `propertyEqual` / `propertyGreaterThan` などすべて string 値を前提としているが、symbol など他の型も扱えるようにする。ただし、クエリのシリアライズ/デシリアライズや SQL へのコンパイルを考えると、string 以外の型を扱う場合は `property` に型情報も含める必要がある（例: `{ type: "propertyEqual", property: { name: "createdAt", type: "date" }, value: "2024-01-01T00:00:00Z" }`）。Tag を扱う処理全体へ影響。このあたりの設計は要検討
