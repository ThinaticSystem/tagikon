import type { OptionalTagPropertyCodec, TagFromShape, TagPropertyCodec } from "./codec.ts";

import { expect, expectTypeOf, suite, test } from "vitest";

import { tpc } from "./codec.ts";

suite("tpc", () => {
	suite("optional()", () => {
		test("returns an OptionalTagPropertyCodec with _optional: true", () => {
			const codec = tpc.string().optional();
			expect(codec._optional).toBe(true);
		});

		test("optional() on an already-optional codec is idempotent", () => {
			const once = tpc.string().optional();
			const twice = once.optional();
			expect(twice._optional).toBe(true);
		});

		test("serialize / deserialize still work after optional()", () => {
			const codec = tpc.string().optional();
			expect(codec.serialize("hello")).toBe("hello");
			expect(codec.deserialize("hello")).toBe("hello");
		});

		test("bigint optional codec round-trips correctly", () => {
			const codec = tpc.bigint().optional();
			expect(codec.serialize(42n)).toBe("42");
			expect(codec.deserialize("42")).toBe(42n);
		});

		test("json optional codec round-trips correctly", () => {
			const codec = tpc.json<{ x: number }>().optional();
			const value = { x: 1 };
			expect(JSON.parse(codec.serialize(value))).toEqual(value);
			expect(codec.deserialize('{"x":1}')).toEqual(value);
		});
	});

	suite("type inference", () => {
		test("tpc.string() is typed as TagPropertyCodec<string, string>", () => {
			expectTypeOf(tpc.string()).toExtend<TagPropertyCodec<string, string>>();
		});

		test("tpc.string().optional() is typed as OptionalTagPropertyCodec<string, string>", () => {
			expectTypeOf(tpc.string().optional()).toEqualTypeOf<
				OptionalTagPropertyCodec<string, string>
			>();
		});

		test("tpc.bigint().optional() is typed as OptionalTagPropertyCodec<bigint, string>", () => {
			expectTypeOf(tpc.bigint().optional()).toEqualTypeOf<
				OptionalTagPropertyCodec<bigint, string>
			>();
		});
	});
});

suite("TagFromShape", () => {
	test("required codecs produce required properties", () => {
		type Shape = {
			readonly id: {
				generate: () => string;
				serialize: (v: string) => string;
				deserialize: (r: string) => string;
			};
			readonly name: ReturnType<typeof tpc.string>;
		};
		type Inferred = TagFromShape<Shape>;
		expectTypeOf<Inferred["id"]>().toEqualTypeOf<string>();
		expectTypeOf<Inferred["name"]>().toEqualTypeOf<string>();
	});

	test("optional() codecs produce optional properties", () => {
		type Shape = {
			readonly id: {
				generate: () => string;
				serialize: (v: string) => string;
				deserialize: (r: string) => string;
			};
			readonly name: ReturnType<typeof tpc.string>;
			readonly description: OptionalTagPropertyCodec<string, string>;
		};
		type Inferred = TagFromShape<Shape>;
		// name must be required
		expectTypeOf<Inferred["name"]>().toEqualTypeOf<string>();
		// description must be optional (string | undefined via optional property)
		expectTypeOf<Inferred>().toExtend<{ readonly description?: string }>();
		// description must NOT be in the required mapped portion
		type DescRequired = "description" extends keyof {
			readonly [TKey in Exclude<keyof Inferred, "description">]: Inferred[TKey];
		}
			? true
			: false;
		expectTypeOf<DescRequired>().toEqualTypeOf<false>();
	});
});
