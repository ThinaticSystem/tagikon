export type TapRawFn<TInput> = (input: Readonly<TInput>) => void | Promise<void>;

// TTransformed defaults to TInput. Override to express a type-changing transform.
export type TransformFn<TInput, TTransformed = TInput> = (
	input: TInput,
) => TTransformed | Promise<TTransformed>;

export type TapTransformedFn<TTransformed> = (
	input: Readonly<TTransformed>,
) => void | Promise<void>;

export type AfterFn<TTransformed, TOutput> = (
	input: Readonly<TTransformed>,
	output: TOutput,
) => void | Promise<void>;

// Per-plugin hook registration for one operation.
// Each plugin provides at most one function per phase.
// TTransformed defaults to TInput; set it explicitly to change the type mid-pipeline.
export interface HookPhases<TInput, TOutput, TTransformed = TInput> {
	tapRaw?: TapRawFn<TInput>;
	transform?: TransformFn<TInput, TTransformed>;
	tapTransformed?: TapTransformedFn<TTransformed>;
	after?: AfterFn<TTransformed, TOutput>;
}
