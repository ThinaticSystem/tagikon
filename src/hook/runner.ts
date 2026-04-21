import type { AfterFn, HookPhases, TapRawFn, TapTransformedFn } from "./types.ts";

// Internal representation after collecting from all plugins.
// transforms use unknown→unknown to allow type-changing transforms to be chained.
interface HookList<TInput, TTransformed, TOutput> {
	tapRaw: TapRawFn<TInput>[];
	transforms: ((input: unknown) => unknown | Promise<unknown>)[];
	tapTransformed: TapTransformedFn<TTransformed>[];
	after: AfterFn<TTransformed, TOutput>[];
}

export function collectHooks<TInput, TOutput, TTransformed = TInput>(
	phases: readonly (HookPhases<TInput, TOutput, TTransformed> | undefined)[],
): HookList<TInput, TTransformed, TOutput> {
	const list: HookList<TInput, TTransformed, TOutput> = {
		tapRaw: [],
		transforms: [],
		tapTransformed: [],
		after: [],
	};
	for (const phase of phases) {
		if (!phase) continue;

		if (phase.tapRaw) list.tapRaw.push(phase.tapRaw);
		if (phase.transform)
			list.transforms.push(
				phase.transform as unknown as (input: unknown) => unknown | Promise<unknown>,
			);
		if (phase.tapTransformed) list.tapTransformed.push(phase.tapTransformed);
		if (phase.after) list.after.push(phase.after);
	}
	return list;
}

export async function runPipeline<TInput, TTransformed, TOutput>(
	hooks: HookList<TInput, TTransformed, TOutput>,
	rawInput: TInput,
	execute: (input: TTransformed) => Promise<TOutput>,
): Promise<TOutput> {
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
	const output = await execute(transformed);

	// Phase 4: After — observers of the result
	for (const fn of hooks.after) {
		await fn(transformed, output);
	}

	return output;
}
