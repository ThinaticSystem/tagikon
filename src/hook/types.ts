export type TapRawFn<TCtx, TInput> = (ctx: TCtx, input: Readonly<TInput>) => void | Promise<void>;

// TTransformed defaults to TInput. Override to express a type-changing transform.
export type TransformFn<TCtx, TInput, TTransformed = TInput> = (
	ctx: TCtx,
	input: TInput,
) => TTransformed | Promise<TTransformed>;

export type TapTransformedFn<TCtx, TTransformed> = (
	ctx: TCtx,
	input: Readonly<TTransformed>,
) => void | Promise<void>;

export type TransformOutputFn<TCtx, TOutput> = (
	ctx: TCtx,
	output: TOutput,
) => TOutput | Promise<TOutput>;

export type AfterFn<TCtx, TTransformed, TOutput> = (
	ctx: TCtx,
	input: Readonly<TTransformed>,
	output: TOutput,
) => void | Promise<void>;

// Per-extension hook registration for one operation.
// Each extension provides at most one function per phase.
// TTransformed defaults to TInput; set it explicitly to change the type mid-pipeline.
export interface HookPhases<TCtx, TInput, TOutput, TTransformed = TInput> {
	tapRaw?: TapRawFn<TCtx, TInput>;
	transform?: TransformFn<TCtx, TInput, TTransformed>;
	tapTransformed?: TapTransformedFn<TCtx, TTransformed>;
	transformOutput?: TransformOutputFn<TCtx, TOutput>;
	after?: AfterFn<TCtx, TTransformed, TOutput>;
}
