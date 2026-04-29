import type { PermissionManifest } from "./permission.ts";

import { expect, suite, test } from "vitest";

import { TaginkonError } from "../core/errors.ts";
import { PermissionDeniedError, assertPermission, hasPermission } from "./permission.ts";

suite("permission", () => {
	const manifest: PermissionManifest = {
		permissions: new Set(["tag:read", "relation:write"] as const),
	};

	suite("hasPermission", () => {
		test("returns true for a granted permission", () => {
			expect(hasPermission(manifest, "tag:read")).toBe(true);
			expect(hasPermission(manifest, "relation:write")).toBe(true);
		});

		test("returns false for an ungranted permission", () => {
			expect(hasPermission(manifest, "tag:write")).toBe(false);
			expect(hasPermission(manifest, "relation:read")).toBe(false);
		});
	});

	suite("assertPermission", () => {
		test("does not throw for a granted permission", () => {
			expect(() => assertPermission(manifest, "tag:read")).not.toThrow();
		});

		test("throws PermissionDeniedError for an ungranted permission", () => {
			expect(() => assertPermission(manifest, "tag:write")).toThrow(PermissionDeniedError);
		});

		test("PermissionDeniedError is a TaginkonError", () => {
			expect(() => assertPermission(manifest, "tag:write")).toThrow(TaginkonError);
		});

		test("error carries the denied permission name", () => {
			try {
				assertPermission(manifest, "tag:write");
				expect.unreachable();
			} catch (e) {
				expect(e).toBeInstanceOf(PermissionDeniedError);
				expect((e as PermissionDeniedError).permission).toBe("tag:write");
			}
		});
	});
});
