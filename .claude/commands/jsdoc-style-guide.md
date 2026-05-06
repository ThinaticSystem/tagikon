# jsdoc-style-guide

公開 API への JSDoc コメント追加時のスタイルガイド。TypeDoc を使用することを前提とする。

## 基本原則

- **JSDoc は英語で書く**（コードが英語識別子であるため）
- CLAUDE.md の「コメントはWHYが非自明な場合のみ」ルールは JSDoc には適用しない。公開 API はすべて JSDoc を書く
- 引数名をそのまま繰り返すだけのコメントは不要
- **コードから読み取れない情報**（制約・副作用・null 条件・意味的な境界ケース）を補うことに注力する

## 構造

```ts
/**
 * <1行の what 要約>
 *
 * <詳細説明（必要な場合のみ）。CommonMark 形式で記述。>
 * <改行が必要な場合は行末に `\` を付ける（フォーマッターで整形されるため）>
 *
 * @param paramName - <意味・制約・null 条件>
 * @returns <返り値の意味。`null` を返す条件は必ず記載>
 * @throws {@link TagNotFoundError} <スローされる条件>
 * @example
 * <コード例>
 */
```

## タグの使い方

### `@param`

引数名から自明な場合は省略してよい。以下の場合は必ず書く:

- 単位・有効範囲がある（例: `limit` が 0 以上を期待する）
- `null` / `undefined` の扱いが非自明（例: `null` を渡すと全件返す等）
- 引数が省略可能で、デフォルトの挙動が非自明

```ts
// Good — 制約を明示
/**
 * @param limit - Maximum number of results. 0 returns all results.
 * @param offset - 0-based index of the first result to return.
 */

// Bad — 引数名の繰り返し
/**
 * @param limit - The limit.
 * @param offset - The offset.
 */
```

### `@returns`

返り値が非自明な場合に記載する。特に `null` を返す条件を明示する。

```ts
// Good
/** @returns The tag, or `null` if no tag with the given ID exists. */

// Bad — 型定義から読み取れる内容の繰り返し
/** @returns A promise that resolves to the tag or null. */
```

### `@throws`

スローされるエラーを `{@link ErrorClass}` で参照しつつ記載する。条件も書く。

```ts
/**
 * @throws {@link TagNotFoundError} if no tag with `id` exists.
 * @throws {@link HierarchyCycleError} if setting `parentId` would create a cycle.
 */
```

### `@example`

積極的に使う。コードブロックは言語タグ付きで記述する。

````ts
/**
 * @example
 * ```ts
 * const tagikon = setupTagikon({ tagShape, storageAdapter });
 * const tag = await tagikon.addTag({ name: "urgent" });
 * ```
 */
````

複数のケースを示す場合は `@example` を複数書く。

````ts
/**
 * @example Basic usage
 * ```ts
 * const keys = await tagikon.findObjects(taggedWithAll(tagsById([urgentId, workId])));
 * ```
 *
 * @example With pagination
 * ```ts
 * const keys = await tagikon.findObjects(q, { limit: 20, offset: 40 });
 * ```
 */
````

### `{@link ...}`

型・クラス・関数を参照するときは常に `{@link}` を使う。TypeDoc がリンクを生成する。

```ts
// Good
/** Use {@link tpc} factory methods with `.optional()` chaining to create instances. */

// Bad
/** Use `tpc` factory methods with `.optional()` chaining to create instances. */
```

public シンボルの JSDoc から private シンボルを参照しない:

```ts
// Bad — ExtensionStorageView は公開シンボルではない
/**
 * Context object passed to extension hooks. The `storage` field is a view
 * that hides {@link ExtensionStorageView}'s internal methods.
 */

// Good — private 実装詳細には触れない
/**
 * Context object passed to extension hooks. The `storage` field provides
 * access to the shared tag store with permission scoping applied.
 */
```

## インターフェース・型のコメント

インターフェース自体にコメントを書き、各フィールドは必要な場合のみコメントを書く。

```ts
/**
 * Per-extension private key-value store. Each extension receives its own
 * isolated store; no other extension can read or write here.
 */
export interface AuxStore<TKey, TData> {
	/** @returns `null` if no entry exists for `key`. */
	find(key: TKey): Promise<null | TData>;
	put(key: TKey, data: TData): Promise<void>;
	/**
	 * Merges `partial` into the existing entry.\
	 * @returns The updated entry, or `null` if no entry existed before the call.
	 */
	patch(key: TKey, partial: Partial<TData>): Promise<null | TData>;
}
```

## 良い例 vs 悪い例

````ts
// Good — コードから読み取れない境界条件を補完している
/**
 * Evaluates an {@link ObjectQuery} against in-memory tag data.
 *
 * The universe of `not` is **all object keys that have at least one tag**.
 * Tagikon has no concept of an object outside of tag relations, so
 * `not(q)` cannot return untagged objects.
 *
 * @example
 * ```ts
 * const keys = await evaluateObjectQueryInMemory(
 *   { listTags, listTagObjects },
 *   taggedWithAny(tagsById([id1, id2])),
 * );
 * ```
 */

// Bad — シグネチャを日本語で言い換えただけ
/**
 * ObjectQuery をインメモリで評価して object keys を返します。
 * @param storage - ストレージ
 * @param query - クエリ
 * @returns ObjectKey の配列
 */
````

## 改行の扱い

TypeDoc は CommonMark に従うため、段落内の通常の改行は無視される。
行末に `\` を付けることで強制改行する（フォーマッターで整形されても `\` は残る）。

```ts
/**
 * Auxiliary data store private to this extension.\
 * Other extensions cannot read or write here.
 */
```

## 確認チェックリスト

JSDoc を追加・修正したら以下を確認する:

```
[ ] 1行目に what 要約がある
[ ] コードから読み取れない情報を補っている（制約・null条件・境界ケース）
[ ] @example が少なくとも1つある（公開APIの場合）
[ ] null を返す可能性がある場合、@returns に明記した
[ ] @throws がある場合、{@link} でエラークラスを参照している
[ ] public シンボルの JSDoc が private シンボルを参照していない
[ ] pnpm docs:generate でエラーが出ないことを確認
```
