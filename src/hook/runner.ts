import type { HookPhases } from "./types.ts";

// Internal representation after collecting from all extensions.
// transforms use unknown→unknown to allow type-changing transforms to be chained.
interface HookList<TInput, TTransformed, TOutput> {
	tapRaw: ((input: Readonly<TInput>) => void | Promise<void>)[];
	transforms: ((input: unknown) => unknown | Promise<unknown>)[];
	tapTransformed: ((input: Readonly<TTransformed>) => void | Promise<void>)[];
	transformOutputs: ((output: unknown) => unknown | Promise<unknown>)[];
	after: ((input: Readonly<TTransformed>, output: TOutput) => void | Promise<void>)[];
}

export interface HookEntry<TCtx, TInput, TOutput, TTransformed = TInput> {
	ctx: TCtx;
	phases: HookPhases<TCtx, TInput, TOutput, TTransformed> | undefined;
}

export const collectHooks = <TCtx, TInput, TOutput, TTransformed = TInput>(
	entries: readonly HookEntry<TCtx, TInput, TOutput, TTransformed>[],
): HookList<TInput, TTransformed, TOutput> => {
	const list: HookList<TInput, TTransformed, TOutput> = {
		tapRaw: [],
		transforms: [],
		tapTransformed: [],
		transformOutputs: [],
		after: [],
	};
	for (const { ctx, phases } of entries) {
		if (!phases) continue;

		if (phases.tapRaw) {
			const fn = phases.tapRaw;
			list.tapRaw.push((input) => fn(ctx, input));
		}
		if (phases.transform) {
			const fn = phases.transform;
			list.transforms.push(
				(input) => fn(ctx, input as TInput) as unknown as Promise<unknown> | unknown,
			);
		}
		if (phases.tapTransformed) {
			const fn = phases.tapTransformed;
			list.tapTransformed.push((input) => fn(ctx, input));
		}
		if (phases.transformOutput) {
			const fn = phases.transformOutput;
			list.transformOutputs.push(
				(output) => fn(ctx, output as TOutput) as unknown as Promise<unknown> | unknown,
			);
		}
		if (phases.after) {
			const fn = phases.after;
			list.after.push((input, output) => fn(ctx, input, output));
		}
	}
	return list;
};

export const runPipeline = async <TInput, TTransformed, TOutput>(
	hooks: HookList<TInput, TTransformed, TOutput>,
	rawInput: TInput,
	execute: (input: TTransformed) => Promise<TOutput>,
): Promise<TOutput> => {
	// Phase 1: TapRaw — observers of the raw input
	for (const fn of hooks.tapRaw) {
		await fn(rawInput);
	}

	// Phase 2: Transform — sequential, potentially type-changing transformation
	let current: unknown = rawInput;
	for (const fn of hooks.transforms) {
		current = await fn(current);
	}
	const transformed = current as TTransformed;

	// Phase 3: TapTransformed — observers of the final transformed input
	for (const fn of hooks.tapTransformed) {
		await fn(transformed);
	}

	// Execute the storage operation
	const rawOutput = await execute(transformed);

	// Phase 4: TransformOutput — sequential transformation of the result
	let currentOutput: unknown = rawOutput;
	for (const fn of hooks.transformOutputs) {
		currentOutput = await fn(currentOutput);
	}
	const output = currentOutput as TOutput;

	// Phase 5: After — observers of the final result
	for (const fn of hooks.after) {
		await fn(transformed, output);
	}

	return output;
};
