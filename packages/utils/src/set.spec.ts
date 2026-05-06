import { expect, suite, test } from "vitest";

import { intersectSets, unionSets } from "./set.ts";

suite("intersectSets", () => {
	test("returns empty set when input is empty", () => {
		expect(intersectSets([])).toEqual(new Set());
	});

	test("returns copy of single set", () => {
		const input = new Set([1, 2, 3]);
		const result = intersectSets([input]);
		expect(result).toEqual(new Set([1, 2, 3]));
		expect(result).not.toBe(input);
	});

	test("returns intersection of two overlapping sets", () => {
		expect(intersectSets([new Set([1, 2, 3]), new Set([2, 3, 4])])).toEqual(new Set([2, 3]));
	});

	test("returns empty set when two sets have no overlap", () => {
		expect(intersectSets([new Set([1, 2]), new Set([3, 4])])).toEqual(new Set());
	});

	test("returns intersection of three sets", () => {
		expect(
			intersectSets([new Set([1, 2, 3, 4]), new Set([2, 3, 4, 5]), new Set([3, 4, 5, 6])]),
		).toEqual(new Set([3, 4]));
	});

	test("returns empty set when one of the sets is empty", () => {
		expect(intersectSets([new Set([1, 2, 3]), new Set()])).toEqual(new Set());
	});

	test("works with string elements", () => {
		expect(intersectSets([new Set(["a", "b", "c"]), new Set(["b", "c", "d"])])).toEqual(
			new Set(["b", "c"]),
		);
	});
});

suite("unionSets", () => {
	test("returns empty set when input is empty", () => {
		expect(unionSets([])).toEqual(new Set());
	});

	test("returns copy of single set", () => {
		const input = new Set([1, 2, 3]);
		const result = unionSets([input]);
		expect(result).toEqual(new Set([1, 2, 3]));
		expect(result).not.toBe(input);
	});

	test("returns union of two sets", () => {
		expect(unionSets([new Set([1, 2]), new Set([3, 4])])).toEqual(new Set([1, 2, 3, 4]));
	});

	test("deduplicates elements present in multiple sets", () => {
		expect(unionSets([new Set([1, 2, 3]), new Set([2, 3, 4])])).toEqual(new Set([1, 2, 3, 4]));
	});

	test("returns union of three sets", () => {
		expect(unionSets([new Set(["a"]), new Set(["b"]), new Set(["c"])])).toEqual(
			new Set(["a", "b", "c"]),
		);
	});

	test("handles empty sets in input", () => {
		expect(unionSets([new Set([1, 2]), new Set(), new Set([3])])).toEqual(new Set([1, 2, 3]));
	});
});
