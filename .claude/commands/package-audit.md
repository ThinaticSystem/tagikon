# package-audit

パッケージ設定の一貫性を監査し、不備があれば修正する。

## 対象

`packages/` 以下の全ワークスペースパッケージ（`tsconfig` パッケージを除く）。

## 調査項目

以下の表を作成し、各パッケージについて調査項目を満たしているかチェックを入れていく。例外がある場合はその理由を記載する。

```markdown
| パッケージ       | tsconfig | tsdown | package.json | root tsconfig ref | vite alias | typedoc |
| ---------------- | -------- | ------ | ------------ | ----------------- | ---------- | ------- |
| (各パッケージ行) |          |        |              |                   |            |         |
```

### 1. `tsconfig.json` チェック項目

- `extends` が `@tagikon/tsconfig/base.json` になっているか
- `include: ["src/**/*.ts"]` になっているか
- `compilerOptions.noEmit: true` になっているか
- `compilerOptions.module: "nodenext"`, `moduleResolution: "nodenext"` になっているか
- `compilerOptions.lib: ["esnext"]`, `types: ["node"]` になっているか
- `paths` に自パッケージ + 実際にソース/テストで使われているワークスペースパッケージが含まれるか
  - spec ファイルが import しているパッケージをすべて `grep` で確認する
  - 推移的依存（例: `id-provider-uuid` は `id-provider-string` を使うので、`id-provider-uuid` を paths に含むパッケージは `id-provider-string` も必要）も考慮する
  - 不要なエントリがある場合は削除する
- `@tagikon/core/testing` path は `storage-adapter-*` のみが持つ（extension/id-provider は不要）

### 2. `tsdown.config.ts` チェック項目

- `entry: ["src/index.ts"]` になっているか
- `outDir: "built"` になっているか
- `dts: { build: true }` になっているか
- `attw: { level: "error", profile: "esm-only" }` になっているか
- `deps.neverBundle` に `dependencies` と `peerDependencies` の全パッケージが含まれるか（`devDependencies` は含めない）

### 3. `package.json` チェック項目

- `name` が `@tagikon/<pkg-dir>` 形式か
- `files: ["built"]` か
- `type: "module"` か
- `main: "./built/index.mjs"`, `module: "./built/index.mjs"`, `types: "./built/index.d.mts"` か
- `exports` フィールドが以下のパターンか:
  ```json
  {
  	".": {
  		"import": {
  			"types": "./built/index.d.mts",
  			"default": "./built/index.mjs"
  		}
  	}
  }
  ```
- `scripts.build: "tsdown"` が存在するか
- `devDependencies` に `@tagikon/tsconfig: "workspace:*"` が含まれるか
- テストでのみ使うワークスペースパッケージが `devDependencies` に適切に宣言されているか（`storage-adapter-drizzle` を参考に）
- 実際にソースで `import` しているパッケージが `dependencies` に含まれているか（`@tagikon/core` が多い）
- ピア依存が `peerDependencies` に含まれているか（`effect`, `drizzle-orm` など）

### 4. Root `tsconfig.json` チェック

- `/tagikon/tsconfig.json` の `references` に `{ "path": "./packages/<pkg>" }` が含まれるか

### 5. Vite alias チェック

- `/tagikon/vite.config.ts` の `alias` 配列に `@tagikon/<pkg>` エントリが含まれるか

### 6. TypeDoc エントリチェック

- `/tagikon/typedoc.json` の `entryPoints` に `packages/<pkg>/src/index.ts` が含まれるか
- `@tagikon/tsconfig` は除外（型定義パッケージのみで公開 API なし）

## 修正手順

不備を発見したら各ファイルを直接 Edit で修正する。大きな変更の場合はユーザーに確認してから修正する。

修正後は必ず `pnpm check` を実行して全チェックが通ることを確認する。

## 新しいパッケージを追加した場合の確認

新パッケージ追加時に必要な変更箇所:

1. `packages/<pkg>/tsconfig.json` 作成
2. `packages/<pkg>/tsdown.config.ts` 作成
3. `packages/<pkg>/package.json` 作成
4. `/tagikon/tsconfig.json` の `references` に追加
5. `/tagikon/vite.config.ts` の `alias` 配列に追加（`@tagikon/core/testing` より後の適切な位置）
6. `/tagikon/typedoc.json` の `entryPoints` に追加（`@tagikon/tsconfig` は除外）
