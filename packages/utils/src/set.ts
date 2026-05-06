/**
 * Returns the intersection of one or more sets — elements present in every set.
 * Returns an empty set when `sets` is empty.
 *
 * @example
 * ```ts
 * import { intersectSets } from "@tagikon/utils";
 *
 * intersectSets([new Set([1, 2, 3]), new Set([2, 3, 4])]); // Set { 2, 3 }
 * ```
 */
export const intersectSets = <TElement>(sets: ReadonlySet<TElement>[]): Set<TElement> => {
	const [first, ...rest] = sets;
	if (!first) return new Set();
	const result = new Set(first);
	for (const set of rest) {
		for (const element of result) {
			if (!set.has(element)) result.delete(element);
		}
	}
	return result;
};

/**
 * Returns the union of zero or more sets — all elements that appear in at least one set.
 *
 * @example
 * ```ts
 * import { unionSets } from "@tagikon/utils";
 *
 * unionSets([new Set([1, 2]), new Set([2, 3])]); // Set { 1, 2, 3 }
 * ```
 */
export const unionSets = <TElement>(sets: ReadonlySet<TElement>[]): Set<TElement> => {
	const result = new Set<TElement>();
	for (const set of sets) {
		for (const element of set) result.add(element);
	}
	return result;
};
