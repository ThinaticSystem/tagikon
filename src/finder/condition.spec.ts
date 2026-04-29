import type { TagId } from "../core/ids.ts";
import type { OrCondition } from "./condition.ts";

import { expect, suite, test } from "vitest";

import { tagId } from "../core/ids.ts";
import { and, has, not, or } from "./condition.ts";

suite("condition builders", () => {
	test("has creates a HasCondition", () => {
		const id = tagId("abc");
		const cond = has(id);

		expect(cond.type).toBe("has");
		expect(cond.tagId).toBe(id);
	});

	test("and creates an AndCondition", () => {
		const id = tagId("a");
		const cond = and([has(id)]);

		expect(cond.type).toBe("and");
		expect(cond.conditions).toHaveLength(1);
	});

	test("or creates an OrCondition", () => {
		const id = tagId("a");
		const cond = or([has(id)]);

		expect(cond.type).toBe("or");
		expect(cond.conditions).toHaveLength(1);
	});

	test("not creates a NotCondition", () => {
		const id = tagId("a");
		const cond = not(has(id));

		expect(cond.type).toBe("not");
		expect(cond.condition.type).toBe("has");
	});

	test("conditions can be nested", () => {
		const id1 = tagId("a");
		const id2 = tagId("b");
		const cond = and([has(id1), or([has(id2)])]);

		expect(cond.type).toBe("and");
		expect(cond.conditions).toHaveLength(2);

		expect(cond.conditions[0]!.type).toBe("has");

		expect(cond.conditions[1]!.type).toBe("or");
		const orCond = cond.conditions[1] as OrCondition<TagId>;
		expect(orCond.conditions).toHaveLength(1);
		expect(orCond.conditions[0]!.type).toBe("has");
	});
});
