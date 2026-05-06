const INITIAL = Symbol("INITIAL");

/**
 * Wraps a zero-argument function so that its return value is computed at most once.
 * Subsequent calls return the cached result without invoking `fn` again.
 *
 * @example
 * ```ts
 * import { memoize } from "@tagikon/utils";
 *
 * let callCount = 0;
 * const expensiveLoad = memoize(() => { callCount++; return fetch("/data"); });
 *
 * const a = expensiveLoad(); // calls fetch
 * const b = expensiveLoad(); // returns cached Promise, callCount is still 1
 * ```
 */
export const memoize = <TValue>(fn: () => TValue): (() => TValue) => {
	let cached: typeof INITIAL | TValue = INITIAL;
	return () => (cached === INITIAL ? (cached = fn()) : cached);
};
