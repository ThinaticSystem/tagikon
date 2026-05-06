import { expect, suite, test } from "vitest";

import { safeJsonParse, safeJsonParseValue } from "./safe-json.ts";

suite("safeJsonParse", () => {
	test("parses a plain object", () => {
		expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
	});

	test("strips __proto__ key", () => {
		const result = safeJsonParse('{"__proto__":{"polluted":true},"safe":1}');
		expect(result).not.toHaveProperty("__proto__");
		expect(result).toHaveProperty("safe", 1);
	});

	test("strips constructor key", () => {
		const result = safeJsonParse('{"constructor":{"evil":true},"ok":2}');
		expect(result).not.toHaveProperty("constructor");
		expect(result).toHaveProperty("ok", 2);
	});

	test("strips prototype key", () => {
		const result = safeJsonParse('{"prototype":{},"x":3}');
		expect(result).not.toHaveProperty("prototype");
		expect(result).toHaveProperty("x", 3);
	});

	test("preserves normal keys", () => {
		expect(safeJsonParse<{ name: string; value: number }>('{"name":"foo","value":42}')).toEqual({
			name: "foo",
			value: 42,
		});
	});

	test("strips dangerous keys in nested objects", () => {
		const result = safeJsonParse('{"nested":{"__proto__":{},"ok":1}}');
		expect(result["nested"] as Record<string, unknown>).not.toHaveProperty("__proto__");
		expect(result["nested"] as Record<string, unknown>).toHaveProperty("ok", 1);
	});

	test("strips dangerous keys inside arrays of objects", () => {
		const result = safeJsonParse('{"items":[{"__proto__":{},"v":1}]}');
		const item = (result["items"] as Record<string, unknown>[])[0];
		expect(item).not.toHaveProperty("__proto__");
		expect(item).toHaveProperty("v", 1);
	});
});

suite("safeJsonParseValue", () => {
	test("parses a string primitive", () => {
		expect(safeJsonParseValue('"hello"')).toBe("hello");
	});

	test("parses a number primitive", () => {
		expect(safeJsonParseValue("42")).toBe(42);
	});

	test("parses a boolean primitive", () => {
		expect(safeJsonParseValue("true")).toBe(true);
	});

	test("parses null", () => {
		expect(safeJsonParseValue("null")).toBeNull();
	});

	test("parses an array as-is", () => {
		expect(safeJsonParseValue("[1,2,3]")).toEqual([1, 2, 3]);
	});

	test("sanitises a plain object", () => {
		const result = safeJsonParseValue('{"__proto__":{},"valid":1}');
		expect(result).not.toHaveProperty("__proto__");
		expect(result).toHaveProperty("valid", 1);
	});

	test("preserves a plain object without dangerous keys", () => {
		expect(safeJsonParseValue('{"key":"value"}')).toEqual({ key: "value" });
	});

	test("strips dangerous keys in array elements", () => {
		const result = safeJsonParseValue('[{"__proto__":{},"v":1},{"ok":2}]') as Record<
			string,
			unknown
		>[];
		expect(result[0]).not.toHaveProperty("__proto__");
		expect(result[0]).toHaveProperty("v", 1);
		expect(result[1]).toEqual({ ok: 2 });
	});

	test("strips dangerous keys in deeply nested objects", () => {
		const result = safeJsonParseValue('{"a":{"b":{"__proto__":{},"c":2}}}') as Record<
			string,
			unknown
		>;
		const b = (result["a"] as Record<string, unknown>)["b"] as Record<string, unknown>;
		expect(b).not.toHaveProperty("__proto__");
		expect(b).toHaveProperty("c", 2);
	});
});
