import type { Permission } from "./permission.ts";

import { expect, suite, test } from "vitest";

import { createSecurityContext } from "./context.ts";

suite("SecurityContext", () => {
	test("hasPermission returns true for a granted permission", () => {
		const ctx = createSecurityContext({ permissions: new Set(["tag:read", "relation:write"]) });
		expect(ctx.hasPermission("tag:read")).toBe(true);
		expect(ctx.hasPermission("relation:write")).toBe(true);
	});

	test("hasPermission returns false for an ungranted permission", () => {
		const ctx = createSecurityContext({ permissions: new Set(["tag:read"]) });
		expect(ctx.hasPermission("tag:write")).toBe(false);
	});

	test("ctx is frozen", () => {
		const ctx = createSecurityContext({ permissions: new Set() });
		expect(Object.isFrozen(ctx)).toBe(true);
	});

	suite("empty permissions manifest grants nothing", () => {
		test.each([
			{ id: "some permission", permission: "tag:read" },
			{ id: "empty string", permission: "" },
			{ id: "undefined", permission: undefined },
			{ id: "null", permission: null },
		] satisfies { id: string; permission: unknown }[])("$id", (case_) => {
			const ctx = createSecurityContext({ permissions: new Set() });
			expect(ctx.hasPermission(case_.permission as Permission)).toBe(false);
		});
	});
});
