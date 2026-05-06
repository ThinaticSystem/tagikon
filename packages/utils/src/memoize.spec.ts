import { expect, suite, test, vi } from "vitest";

import { memoize } from "./memoize.ts";

suite("memoize", () => {
	test("calls the wrapped function on first invocation", () => {
		const fn = vi.fn(() => 42);
		const memo = memoize(fn);
		expect(memo()).toBe(42);
		expect(fn).toHaveBeenCalledOnce();
	});

	test("returns cached result on subsequent calls", () => {
		const fn = vi.fn(() => 42);
		const memo = memoize(fn);
		memo();
		memo();
		memo();
		expect(fn).toHaveBeenCalledOnce();
	});

	test("each memoized wrapper has its own cache", () => {
		let counter = 0;
		const memoA = memoize(() => ++counter);
		const memoB = memoize(() => ++counter);
		expect(memoA()).toBe(1);
		expect(memoB()).toBe(2);
		expect(memoA()).toBe(1);
		expect(memoB()).toBe(2);
	});

	test("caches falsy values (0, false, empty string)", () => {
		const fn = vi.fn(() => 0 as number);
		const memo = memoize(fn);
		expect(memo()).toBe(0);
		expect(memo()).toBe(0);
		expect(fn).toHaveBeenCalledOnce();
	});

	test("caches null", () => {
		const fn = vi.fn((): null => null);
		const memo = memoize(fn);
		expect(memo()).toBeNull();
		expect(memo()).toBeNull();
		expect(fn).toHaveBeenCalledOnce();
	});
});
