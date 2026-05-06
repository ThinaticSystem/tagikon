import type { OptionalTagPropertyCodec, TagPropertyCodec } from "@tagikon/core";

import * as S from "effect/Schema";
import { expect, expectTypeOf, suite, test } from "vitest";

import { fromEffectSchema } from "./index.ts";

suite("fromEffectSchema", () => {
	suite("identity schema (String → string)", () => {
		const codec = fromEffectSchema(S.String);

		test("serialize returns value as-is", () => {
			expect(codec.serialize("hello")).toBe("hello");
		});

		test("deserialize returns value as-is", () => {
			expect(codec.deserialize("hello")).toBe("hello");
		});

		test("is typed as TagPropertyCodec<string, string>", () => {
			expectTypeOf(codec).toExtend<TagPropertyCodec<string, string>>();
		});
	});

	suite("NumberFromString schema", () => {
		const codec = fromEffectSchema(S.NumberFromString);

		test("serialize encodes number to string", () => {
			expect(codec.serialize(0)).toBe("0");
			expect(codec.serialize(42)).toBe("42");
			expect(codec.serialize(-1.5)).toBe("-1.5");
		});

		test("deserialize decodes string to number", () => {
			expect(codec.deserialize("0")).toBe(0);
			expect(codec.deserialize("42")).toBe(42);
			expect(codec.deserialize("-1.5")).toBe(-1.5);
		});

		test("is typed as TagPropertyCodec<number, string>", () => {
			expectTypeOf(codec).toExtend<TagPropertyCodec<number, string>>();
		});

		test("deserialize throws ParseError on non-numeric string", () => {
			expect(() => codec.deserialize("not-a-number")).toThrow();
		});
	});

	suite("schema with validation (minLength)", () => {
		const NonEmptyString = S.String.pipe(S.minLength(1));
		const codec = fromEffectSchema(NonEmptyString);

		test("deserialize accepts valid input", () => {
			expect(codec.deserialize("hello")).toBe("hello");
		});

		test("deserialize throws ParseError on empty string", () => {
			expect(() => codec.deserialize("")).toThrow();
		});
	});

	suite(".optional()", () => {
		test("returns an OptionalTagPropertyCodec with _optional: true", () => {
			const codec = fromEffectSchema(S.String).optional();
			expect(codec._optional).toBe(true);
		});

		test("is typed as OptionalTagPropertyCodec<string, string>", () => {
			expectTypeOf(fromEffectSchema(S.String).optional()).toExtend<
				OptionalTagPropertyCodec<string, string>
			>();
		});

		test("optional() on an already-optional codec is idempotent", () => {
			const codec = fromEffectSchema(S.String).optional();
			expect(codec.optional()).toBe(codec);
		});

		test("serialize / deserialize still work after optional()", () => {
			const codec = fromEffectSchema(S.NumberFromString).optional();
			expect(codec.serialize(7)).toBe("7");
			expect(codec.deserialize("7")).toBe(7);
		});
	});

	suite("type inference", () => {
		test("NumberFromString produces TagPropertyCodec<number, string>", () => {
			expectTypeOf(fromEffectSchema(S.NumberFromString)).toExtend<
				TagPropertyCodec<number, string>
			>();
		});

		test("String produces TagPropertyCodec<string, string>", () => {
			expectTypeOf(fromEffectSchema(S.String)).toExtend<TagPropertyCodec<string, string>>();
		});
	});
});
