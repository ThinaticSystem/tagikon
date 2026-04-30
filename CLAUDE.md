# Tagikon — CLAUDE.md

## プロジェクト概要

**Tagikon（滾滾）** — オブジェクトをタグベースで管理するTypeScriptライブラリ。

- オブジェクト = 主キーを持つ任意のもの（文字列キーで識別）
- タグでオブジェクトを検索する
- ファイルエクスプローラー・メモアプリなどのユーザーリソース管理機能に組み込み可能
- プラグインシステムにより Storage / Finder / Hook / Custom API を拡張可能

---

## テクノロジースタック

| ツール                                    | 用途                          |
| ----------------------------------------- | ----------------------------- |
| TypeScript (ESNext, `erasableSyntaxOnly`) | 言語                          |
| `@typescript/native-preview` (`tsgo`)     | 型チェック (`pnpm typecheck`) |
| Vitest                                    | テスト (`pnpm test`)          |
| oxlint + oxfmt                            | Lint / フォーマット           |

### TypeScript 設定の制約

- `erasableSyntaxOnly: true` — enum・namespace・パラメータプロパティ禁止。代替: `const` オブジェクト + `satisfies`、または branded type
- `verbatimModuleSyntax: true` — 型のみインポートは必ず `import type`
- `noUncheckedIndexedAccess: true` — 配列・オブジェクトのインデックスアクセスは `T | undefined`
- `exactOptionalPropertyTypes: true` — `prop?: T` に `undefined` を明示代入不可
- `allowImportingTsExtensions: true` — 相対インポートは `.ts` 拡張子を明示する

---

## コーディング規約

### 基本方針

- コメントはWHYが非自明な場合のみ。WHATを説明するコメント禁止
- 型安全を最優先。`any` / `unknown` を不必要に使わない（型制約には `unknown`、条件型推論でも `any` 禁止）
- 副作用のない純粋関数を基本とし、副作用は Storage Adapter に閉じ込める
- エラーは必ず `TagikonError`（`src/core/errors.ts`）を継承する。`Error` の直接継承禁止（文字列スロー禁止）
- TypeScriptスタイルのprivateアクセサーの使用は禁止。ECMAScriptの`#`-prefixアクセサーを使用する
- アクロニムの使用は原則禁止（例外的に `API` / `ID` / `URL` など、既存の概念の場合のみ許可）

  コールバック引数の命名など、即時的な記述の場合もアクロニムは禁止

### null / undefined の使い分け

- **`null`** — 値が存在しないことを明示的に表す返り値（例: `getTag()` がヒットしなかった場合）
- **`undefined`** — デフォルト値・未指定のセマンティクスのみ（省略可能な引数 `options?: Foo` など）
- 返り値に `undefined` を使わない。「ない」を表すときは常に `null`

### 型定義の順序

nullable / undefinedable な型は修飾子を前置する。変数名・メソッド名から本体の型は推測できるが、`null` / `undefined` は推測できないため情報の優先度が高い。

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
- 定数オブジェクト（enumの代替）: `SCREAMING_SNAKE_CASE`
- プライベートなモジュール内部シンボルには `_` プレフィックスを付けない（ファイルスコープで管理）
- **`export` はファイル末尾にまとめて書かない。宣言にインラインで付ける**（`export interface Foo`、`export function bar`）。末尾の `export { ... }` 禁止。`src/index.ts` の re-export は例外
- **複数のものを返すAPIは `list` プレフィックス**（`listTags()`, `listObjectTags()` など）。`get` は単一取得に限定

### 型パラメータの命名

型パラメータは **`T` プレフィックス + 略さない具体的な名前** とする。`T`・`R`・`U` など1文字の型パラメータは禁止。

```typescript
// Good
type FunctionType<TInput, TOutput = TInput> = ...

// Bad — 1文字は何を表すか不明
type FunctionType<T, R = T> = ...
```

### ジェネリクス制約でのデフォルト引数の活用

「あらゆるサブタイプを受け入れる」制約を書く際は、型パラメータのデフォルト引数を活用し、具体的な型引数を繰り返し書かない。

```typescript
// Good — デフォルトを活用。Tag の型パラメータが変わっても制約サイトは変更不要
function foo<T extends Tag>(...): ...

// Bad — 具体的なスーパータイプを繰り返す。Tag の型パラメータ変更時に全箇所更新が必要
function foo<T extends Tag<string, unknown>>(...): ...
```

### 関数は可能な限りアロー関数で宣言する

関数宣言は `function` キーワードではなくアロー関数で行う。`this` を使う必要やジェネレーターを返す場合は例外的に `function` 宣言を許可する。

```typescript
// Good — this を使わない関数はアロー関数で宣言
const myFunction = (arg: Type): ReturnType => { ... };
```

```typescript
// Bad — this を使わない関数は function 宣言禁止
function myFunction(arg: Type): ReturnType { ... }
```

### 配列を受け取る関数の引数は readonly

関数・メソッドが配列を受け取る場合、引数型は `readonly` を付ける。呼び出し側は変更の意図がないことをコンパイル時に保証でき、実装側は不変であることを期待できる。

```typescript
// Good
pickItem<TElement>(items: readonly TElement[], index: number): null | TElement;

// Bad
pickItem<TElement>(items: TElement[], index: number): null | TElement;
```

配列を返す場合（`listTags(): Promise<T[]>`）は readonly 不要。

### ファイル内の凝集

同一概念に属する宣言は物理的にまとめて配置する。branded typeを例に:

```typescript
// Good — brand symbol・型・factoryが1グループ
declare const tagIdBrand: unique symbol;
export type TagId = string & { readonly [tagIdBrand]: never };
export const tagId = (raw: string): TagId => { ... };

declare const objectKeyBrand: unique symbol;
export type ObjectKey = string & { readonly [objectKeyBrand]: never };
export const objectKey = (raw: string): ObjectKey => { ... };

// Bad — 全symbolをまとめ、全型をまとめ、全factoryをまとめる（概念が分断される）
```

### モジュール設計

- 1ファイル1責務。循環参照を避けるため依存は常に上位→下位方向
- `src/index.ts` はライブラリの公開エントリーポイント（re-exportのみ）
- 内部モジュールは `src/internal/` 以下に配置し、公開APIから隠蔽する

---

## ディレクトリ構成

```
src/
  index.ts               # 公開エントリーポイント（re-exportのみ）
  core/
    ids.ts               # TagId / ObjectKey branded types + factory functions
    tag-kind.ts          # TAG_KIND 定数 + TagKind 型
    tag.ts               # Tag インターフェース（最小: id のみ）+ IdOf
    relation.ts          # TagRelation インターフェース
    errors.ts            # ドメインエラークラス（TagikonError 基底）
  api/
    server.ts            # Server API（addTag / listTags / editTag / removeTag / ...）
  plugin/
    types.ts             # プラグインインターフェース定義
    registry.ts          # プラグイン登録・管理
  hook/
    types.ts             # フックフェーズ型定義（TapRaw / Transform / TapTransformed / After）
    runner.ts            # フック実行エンジン
  storage/
    adapter.ts           # Storage Adapter インターフェース
    memory.ts            # インメモリ参照実装
  security/
    permission.ts        # Permissionマニフェスト・実行時ガード
    context.ts           # ctxオブジェクト（freeze済み）
```

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────┐
│              Server API                 │  ← ユーザーが呼び出す公開API
└──────────────┬──────────────────────────┘
               │ 各操作ごとにフックを実行
┌──────────────▼──────────────────────────┐
│           Hook Runner                   │
│  1. beforeXxx (TapRaw)                  │
│  2. beforeXxx (Transform)               │
│  3. beforeXxx (TapTransformed)          │
│  4. afterXxx                            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Storage Adapter                 │  ← 差し替え可能（DB/インメモリ/etc）
└─────────────────────────────────────────┘
```

### プラグインシステム

プラグインは以下の拡張ポイントを持つ:

| 種別              | 役割                                                           |
| ----------------- | -------------------------------------------------------------- |
| `TagImplement`    | `Tag` を intersection で拡張（description・hierarchy等の属性） |
| `StorageAdapter`  | タグ保存・読み込みインターフェース実装                         |
| `FinderImplement` | オブジェクト検索エンジンの実装                                 |
| `EventHook`       | 操作前後のフック登録                                           |
| `CustomAPI`       | API追加（登録時にジェネリクスで型推論）                        |

`TagImplement` プラグインはコア `Tag`（id のみ）を intersection で拡張する。
StorageAdapter / Server API は `TTag extends Tag` のジェネリクスで拡張型を伝播させる。

```typescript
// 例: DescriptionPlugin が Tag を拡張
interface TagWithDescription extends Tag {
	readonly description: string;
}
const server = createServer<TagWithDescription>({ storage: new MyAdapter() });
const tag = await server.addTag({ description: "foo" }); // tag は TagWithDescription として型付け
```

Custom APIプラグインはコンテキスト(`ctx`)を受け取れる。`ctx`は`Object.freeze()`済みで書き換え不可。

**タグ階層はコアAPIから除外されプラグインが提供する。**
ツリー型・DAG型それぞれを別プラグインとして実装可能。
コアには `listTags()` （フラットリスト）のみ残す。

### セキュリティ制約

- `ctx`にORMオブジェクトを持たせない
- Permissionマニフェストで各プラグインの権限を宣言・実行時ガード
- タイムアウト制御（プラグインごとにユーザーが上限引き上げ可能）

---

## Server API 仕様

### タグ操作

| API                       | 説明                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `addTag(attributes)`      | タグ追加（`id` を除く全属性を渡す。プラグインの transform フックで属性を補完・上書き可能） |
| `listTags()`              | タグのフラットリストを取得（階層構造はHierarchyPluginが提供）                              |
| `editTag(id, patch)`      | タグ情報の編集（追加属性はプラグインが提供。階層変更はHierarchyPlugin経由）                |
| `removeTag(id, options?)` | タグ削除（プラグイン機能として削除時に対象オブジェクトへシステムタグ付与フックを呼び出す） |

### オブジェクト操作

| API                                  | 説明                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| `tagObjects(tagId, objectKeys[])`    | 複数オブジェクトへタグを付与                                          |
| `untagObjects(tagId, objectKeys[])`  | 複数オブジェクトからタグ付け解除                                      |
| `resetWithTags(objectKey, tagIds[])` | オブジェクトのタグを指定セットで上書き（差分を自動計算して付与/解除） |
| `findObjectsByTags(query)`           | タグ付きオブジェクトを検索（Finderプラグインに委譲）。キーのみ返す    |

---

## イベントフック フェーズ設計

各オペレーションにつき以下5フェーズのフックが存在する（`addTag`を例に）:

1. `beforeAddTag` **TapRaw** — 入力をそのまま受け取る
2. `beforeAddTag` **Transform** — 入力を変換する（プラグイン登録順に実行）
3. `beforeAddTag` **TapTransformed** — 変換後の入力を受け取る
4. **TransformOutput** — ストレージ操作の結果を変換する（出力フィルタリング等）
5. `afterAddTag` — 最終的な結果を受け取るオブザーバー

---

## コアエンティティ設計

### Tag（最小エンティティ）

`Tag<TId>` は `id` のみを持つ。`name` を含むすべての属性はすべて `TagImplement` プラグインまたは利用者が intersection で提供する。

```typescript
// TId — IDの型。デフォルトは unknown（最大寛容）。
// 制約サイトは T extends Tag と書けば十分。具体的なコードは Tag<TagId> を明示する。
interface Tag<TId = unknown> {
	readonly id: TId;
}

// ユーティリティ型（型パラメータ名は T prefix を使用）
type IdOf<TTag extends Tag> = TTag extends Tag<infer TId> ? TId : never;
```

`TTag extends Tag` として伝播させることで、StorageAdapter / Server API の各メソッドが `id` の型を正しく制約できる。

```typescript
// 例: name / kind / description を持つタグ
type MyTag = Tag<TagId> & {
	readonly name: string;
	readonly kind: "user" | "system";
	readonly description: string;
};

const server = createServer<MyTag>({ storage: new MyAdapter() });
await server.addTag({ name: "foo", kind: "user", description: "" }); // transform フックで属性を補完可能
```

### TagId / ObjectKey（Branded Types）

混同を防ぐため `unique symbol` で branded type として定義。

- `tagId(raw: string): TagId` — StorageAdapter など内部境界で使用（ライブラリ外部には露出しない）
- `objectKey(raw: string): ObjectKey` — ライブラリ利用者がオブジェクトキーを作成する際に使用

`Tag` の `TId` デフォルトは `unknown`（最大寛容）。具体的なコードでは `Tag<TagId>` と明示する。ID生成プラグインを使う場合は `TId = number` 等の別の型に差し替わる。

### Tag Kind（プラグイン提供）

`kind` はコア `Tag` から除外された。`src/core/tag-kind.ts` に `TAG_KIND` / `TagKind` の定義は残っているがコアAPIからは非公開で、プラグインが独自に提供する属性として扱う。

### エラー階層

```
TagikonError (基底)
  ├── TagNotFoundError       { tagId: TagId }
  ├── TagAlreadyExistsError  { tagName: string }
  └── ObjectNotTaggedError   { tagId: TagId, objectKey: ObjectKey }
```

すべてのライブラリエラーは `TagikonError` を継承。`instanceof TagikonError` でライブラリ由来エラーか判定可能。

---

## Storage Adapter インターフェース

```typescript
// 無引数インスタンス化が型安全になるよう concrete default を明示する
interface StorageAdapter<TTag extends Tag = Tag<TagId>> {
	createTag(data: Omit<TTag, "id">): Promise<TTag>;
	getTag(id: IdOf<TTag>): Promise<null | TTag>;
	listTags(): Promise<TTag[]>;
	updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	// true=削除した, false=存在しなかった（何も変更しなかった）
	deleteTag(id: IdOf<TTag>): Promise<boolean>;

	addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	listObjectTags(objectKey: ObjectKey): Promise<IdOf<TTag>[]>;
	listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]>;
}
```

**設計上の決定事項:**

- `name` はコアに含めない。利用者がコアを `TagWithName` で intersection 拡張して使う
- `TId` は独立した型パラメータとせず `IdOf<T>` をインラインで使用（常に `IdOf<T>` と等価のため）
- ID生成はアダプターが内部で行う（ID生成プラグインをアダプターのコンストラクタに注入する方式）

---

## テスト方針

- 各モジュールに `.spec.ts` を同階層に配置
- インメモリ Storage Adapter を使って統合テストを記述する（外部DBのモック禁止）
- テストは `vitest` で実行: `pnpm test:run`
- 全チェック: `pnpm check`（format:dry → lint → typecheck → test:run）
- **テストのグループ化は `suite` / `test`（`describe` / `it` 禁止）**

---

## 開発フロー

```bash
pnpm test          # ウォッチモードでテスト
pnpm typecheck     # 型チェック（tsgo --build）
pnpm lint          # oxlint
pnpm format        # oxfmt
pnpm check         # CI相当の全チェック
```

新しいモジュールを追加する際は:

1. `src/<layer>/<module>.ts` にドメインロジックを実装
2. `src/<layer>/<module>.spec.ts` にテストを記述
3. 公開すべきものは `src/index.ts` からre-export

### CLAUDE.md の更新ルール

作業が完了したら必ずこのファイルを更新する:

- 完了したタスクは「未実装」から「完了」テーブルへ移動する
- 完了テーブルのクラス名・関数名など固有名詞はコードの実態に合わせる
- セッション間の引き継ぎ情報（完了サマリー・次タスク）はメモリ（`~/.claude/projects/-tagikon/memory/`）に書く。このファイルには書かない

---

## 実装状況

### 完了

| ファイル                           | 内容                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/core/ids.ts`                  | `TagId` / `ObjectKey` branded types + factory                                                                                |
| `src/core/tag-kind.ts`             | `TAG_KIND` 定数 + `TagKind` 型（コア非公開・プラグイン向けユーティリティ）                                                   |
| `src/core/tag.ts`                  | `Tag<TId>` (default: unknown) + `IdOf<TTag>`（`name` / `kind` はコアから除外。`id` のみ）                                    |
| `src/core/relation.ts`             | `TagRelation` インターフェース                                                                                               |
| `src/core/errors.ts`               | `TagikonError` / `TagNotFoundError` / `TagAlreadyExistsError` / `ObjectNotTaggedError`                                       |
| `src/storage/adapter.ts`           | `StorageAdapter<TTag>` インターフェース（default: `Tag<TagId>`）                                                             |
| `src/storage/memory.ts`            | `MemoryStorageAdapter<TTag>` インメモリ参照実装（`idPlugin` 注入対応・双方向リレーション管理）                               |
| `src/storage/memory.spec.ts`       | `MemoryStorageAdapter` 単体テスト（カスタム idPlugin スイート含む）                                                          |
| `src/hook/types.ts`                | `TapRawFn` / `TransformFn` / `TapTransformedFn` / `TransformOutputFn` / `AfterFn` / `HookPhases`（5フェーズ）                |
| `src/hook/runner.ts`               | `collectHooks` / `runPipeline`（5フェーズ実行エンジン）                                                                      |
| `src/plugin/types.ts`              | `TagikonPlugin<TTag>`（`hooks?:` でフックをグループ化）/ `FinderImplement<TTag>` + 各操作の Input 型エイリアス               |
| `src/plugin/tag-id-plugin.ts`      | `TagIdPlugin<TId>` インターフェース + `stringTagIdPlugin` ヘルパー + `UUID_TAG_ID_PLUGIN` デフォルト                         |
| `src/plugin/tag-id-plugin.spec.ts` | `TagIdPlugin` ユニットテスト                                                                                                 |
| `src/finder/condition.ts`          | `TagCondition<TId>` discriminated union + `has` / `tagProperty` / `and` / `or` / `not` builder 関数                          |
| `src/finder/condition.spec.ts`     | condition builder ユニットテスト                                                                                             |
| `src/finder/memory-finder.ts`      | `MemoryFinder<TTag>` — `has` / `tag-property` / `and` / `or` / `not` を評価する `FinderImplement` 実装                       |
| `src/finder/memory-finder.spec.ts` | `MemoryFinder` 統合テスト（has / and / or / not / 入れ子）                                                                   |
| `src/api/server.ts`                | `Server<TTag>` インターフェース + `createServer`（全8操作）                                                                  |
| `src/api/server.spec.ts`           | Server 統合テスト（フック動作・TagImplement拡張含む）                                                                        |
| `src/security/permission.ts`       | `Permission` / `PermissionManifest` / `PermissionDeniedError` / `hasPermission` / `assertPermission`                         |
| `src/security/permission.spec.ts`  | permission ユニットテスト                                                                                                    |
| `src/security/context.ts`          | `SecurityContext` インターフェース + `createSecurityContext`（freeze済み）                                                   |
| `src/security/context.spec.ts`     | SecurityContext ユニットテスト                                                                                               |
| `src/index.ts`                     | 公開エントリーポイント（上記すべてをre-export）                                                                              |
| `src/index.spec.ts`                | 公開API エンドツーエンドテスト（core workflow / MemoryFinder / TagImplement / Custom API）                                   |
| `src/plugin/context.ts`            | `PluginContext<TTag>` インターフェース + `createPluginContext`                                                               |
| `src/plugin/use.ts`                | `use()` プラグイン登録 + `PluginRegistration<TNamespace, TApi>`（Permission照合）                                            |
| `src/plugin/use.spec.ts`           | `use()` ユニットテスト（Permission照合・frozen戻り値）                                                                       |
| `src/plugin/soft-delete.ts`        | `TagWithSoftDelete` / `createSoftDelete` / `SOFT_DELETE_NS` / `SoftDeleteApi`（StorageAdapter 実装なし）                     |
| `src/plugin/soft-delete.spec.ts`   | SoftDeletePlugin 統合テスト（softDeleteTag / listSoftDeletedTags / restoreTag / relations 保持 / TagPropertyCondition 連携） |

### 未実装（次に着手）

- **プラグインの再帰登録** — プラグインAがプラグインBに依存したい場合に、Aの登録関数内でBを登録して呼び出せるようにする（`use()`の中でさらに`use()`）

  ただしプラグイン内で登録されたBは他のプラグインやユーザーコードからは見えない（Aの内部実装の一部）という扱いにする  
  Private Contextを用意して、そこにAPIを登録する方針

- **タグの階層構造** — ディレクトリを表現するためのプラグイン。`HierarchyPlugin` として実装する。

  ファイルエクスプローラーなどのユースケースを想定し、ツリー構造を提供する。タグの親子関係を管理し、`listTags()` はフラットリストのまま提供する（階層構造はプラグインが管理）  
  階層変更は `editTag()` 経由で行う  
  カスタムAPIで階層関連の操作を提供する（例: `moveTag(id, newParentId)`）

### 未確定事項（設計中）

- **タグの使用回数カウント（usage count）** — コアに持つか、Storage Adapterの集計クエリとして提供するか（どちらにせよプラグインで提供する方向）
