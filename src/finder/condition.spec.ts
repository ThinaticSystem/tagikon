import type { Uuid } from "../plugins/id-providers/uuid-id-provider/index.ts";
import type { OrCondition } from "./condition.ts";

import { expect, suite, test } from "vitest";

import { uuid } from "../plugins/id-providers/uuid-id-provider/index.ts";
import {
	and,
	has,
	not,
	or,
	tagProperty,
	tagPropertyContains,
	tagPropertyEndsWith,
	tagPropertyGreaterThan,
	tagPropertyGreaterThanOrEqual,
	tagPropertyLessThan,
	tagPropertyLessThanOrEqual,
	tagPropertyStartsWith,
} from "./condition.ts";

suite("condition builders", () => {
	test("has creates a HasCondition", () => {
		const id = uuid("abc");
		const cond = has(id);

		expect(cond.type).toBe("has");
		expect(cond.tagId).toBe(id);
	});

	test("and creates an AndCondition", () => {
		const id = uuid("a");
		const cond = and([has(id)]);

		expect(cond.type).toBe("and");
		expect(cond.conditions).toHaveLength(1);
	});

	test("or creates an OrCondition", () => {
		const id = uuid("a");
		const cond = or([has(id)]);

		expect(cond.type).toBe("or");
		expect(cond.conditions).toHaveLength(1);
	});

	test("not creates a NotCondition", () => {
		const id = uuid("a");
		const cond = not(has(id));

		expect(cond.type).toBe("not");
		expect(cond.condition.type).toBe("has");
	});

	test("conditions can be nested", () => {
		const id1 = uuid("a");
		const id2 = uuid("b");
		const cond = and([has(id1), or([has(id2)])]);

		expect(cond.type).toBe("and");
		expect(cond.conditions).toHaveLength(2);

		expect(cond.conditions[0]!.type).toBe("has");

		expect(cond.conditions[1]!.type).toBe("or");
		const orCond = cond.conditions[1] as OrCondition<Uuid>;
		expect(orCond.conditions).toHaveLength(1);
		expect(orCond.conditions[0]!.type).toBe("has");
	});

	suite("tagProperty builders", () => {
		test("tagProperty creates a TagPropertyEqualCondition", () => {
			const cond = tagProperty("name", "foo");
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("equal");
			expect(cond.property).toBe("name");
			expect(cond.value).toBe("foo");
		});

		test("tagPropertyContains creates a TagPropertyContainsCondition", () => {
			const cond = tagPropertyContains("name", "oo");
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("contains");
			expect(cond.property).toBe("name");
			expect(cond.value).toBe("oo");
		});

		test("tagPropertyStartsWith creates a TagPropertyStartsWithCondition", () => {
			const cond = tagPropertyStartsWith("name", "fo");
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("starts-with");
			expect(cond.property).toBe("name");
			expect(cond.value).toBe("fo");
		});

		test("tagPropertyEndsWith creates a TagPropertyEndsWithCondition", () => {
			const cond = tagPropertyEndsWith("name", "oo");
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("ends-with");
			expect(cond.property).toBe("name");
			expect(cond.value).toBe("oo");
		});

		test("tagPropertyGreaterThan creates a TagPropertyGreaterThanCondition", () => {
			const cond = tagPropertyGreaterThan("score", 10);
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("greater-than");
			expect(cond.property).toBe("score");
			expect(cond.value).toBe(10);
		});

		test("tagPropertyLessThan creates a TagPropertyLessThanCondition", () => {
			const cond = tagPropertyLessThan("score", 10);
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("less-than");
			expect(cond.property).toBe("score");
			expect(cond.value).toBe(10);
		});

		test("tagPropertyGreaterThanOrEqual creates a TagPropertyGreaterThanOrEqualCondition", () => {
			const cond = tagPropertyGreaterThanOrEqual("score", 10);
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("greater-than-or-equal");
			expect(cond.property).toBe("score");
			expect(cond.value).toBe(10);
		});

		test("tagPropertyLessThanOrEqual creates a TagPropertyLessThanOrEqualCondition", () => {
			const cond = tagPropertyLessThanOrEqual("score", 10);
			expect(cond.type).toBe("tag-property");
			expect(cond.match).toBe("less-than-or-equal");
			expect(cond.property).toBe("score");
			expect(cond.value).toBe(10);
		});
	});
});
