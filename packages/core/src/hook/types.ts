/**
 * Phase 1 — observes the raw input as it arrived from the caller.\
 * Cannot mutate the input; useful for logging or metrics.
 */
export type TapRawFn<TCtx, TInput> = (ctx: TCtx, input: Readonly<TInput>) => void | Promise<void>;

/**
 * Phase 2 — transforms the input. Each extension's `transform` runs in
 * registration order, with the previous extension's output feeding the
 * next one. The final transformed input is passed to the storage operation.\
 * Use this to inject default values, sanitize input, or change the input shape.
 *
 * @typeParam TTransformed - Defaults to `TInput`. Set explicitly when the
 *   transform changes the type (e.g. enriching with derived fields).
 */
export type TransformFn<TCtx, TInput, TTransformed = TInput> = (
	ctx: TCtx,
	input: TInput,
) => TTransformed | Promise<TTransformed>;

/**
 * Phase 3 — observes the fully transformed input just before the storage
 * operation runs. Cannot mutate; symmetric counterpart of `tapRaw`.
 */
export type TapTransformedFn<TCtx, TTransformed> = (
	ctx: TCtx,
	input: Readonly<TTransformed>,
) => void | Promise<void>;

/**
 * Phase 4 — transforms the storage operation's output. Each extension's
 * `transformOutput` runs in registration order, chaining like `transform`.\
 * Use this for output filtering (e.g. soft-deleted tags hidden from
 * `listTags`) or augmenting the response.
 */
export type TransformOutputFn<TCtx, TOutput> = (
	ctx: TCtx,
	output: TOutput,
) => TOutput | Promise<TOutput>;

/**
 * Phase 5 — observes the final input/output pair after every transformation.\
 * Useful for side effects that should reflect the committed state
 * (e.g. writing to an extension's AuxStore after a tag is created).
 */
export type AfterFn<TCtx, TTransformed, TOutput> = (
	ctx: TCtx,
	input: Readonly<TTransformed>,
	output: TOutput,
) => void | Promise<void>;

/**
 * Per-extension hook registration for a single operation. Each extension
 * may provide at most one function per phase; phases run in the order
 * `tapRaw` → `transform` → `tapTransformed` → (storage call) →
 * `transformOutput` → `after`.
 *
 * @typeParam TCtx - Extension context type (typically `ExtensionContext<TTag, TAux, TChildrenApi>`).
 * @typeParam TInput - The operation's raw input type.
 * @typeParam TOutput - The operation's output type.
 * @typeParam TTransformed - Defaults to `TInput`. Override to change the
 *   input type mid-pipeline.
 *
 * @example Logging input and output
 * ```ts
 * const myExt: Extension<MyTag> = {
 *   hooks: {
 *     addTag: {
 *       tapRaw: (_ctx, input) => console.log("addTag input", input),
 *       after: (_ctx, _input, tag) => console.log("addTag created", tag.id),
 *     },
 *   },
 * };
 * ```
 */
export interface HookPhases<TCtx, TInput, TOutput, TTransformed = TInput> {
	tapRaw?: TapRawFn<TCtx, TInput>;
	transform?: TransformFn<TCtx, TInput, TTransformed>;
	tapTransformed?: TapTransformedFn<TCtx, TTransformed>;
	transformOutput?: TransformOutputFn<TCtx, TOutput>;
	after?: AfterFn<TCtx, TTransformed, TOutput>;
}
