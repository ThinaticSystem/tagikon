---
title: core/src/hook
layer: core
type: reference
tags: [core, hook, runner]
---

# `core/src/hook`

5 フェーズの Hook 実行エンジンと型定義。

## 責務

- 各オペレーションのフックフェーズ型 (`tapRaw` / `transform` / `tapTransformed` / `transformOutput` / `after`) を定義
- 複数 Extension にまたがる Hook を 1 つのパイプラインに合成して順に実行する Runner

## ファイル一覧

| ファイル               | 役割                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| [types.ts](types.ts)   | `TapRawFn` / `TransformFn` / `TapTransformedFn` / `TransformOutputFn` / `AfterFn` / `HookPhases` |
| [runner.ts](runner.ts) | `collectHooks(entries)` / `runPipeline` — 5 フェーズ実行エンジン                                 |

## 関連ドキュメント

- [../../docs/arch/hook-lifecycle.md](../../docs/arch/hook-lifecycle.md) — フェーズの詳細仕様とシーケンス
