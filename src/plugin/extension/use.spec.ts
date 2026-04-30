import type { Tag } from "../../core/tag.ts";
import type { Extension } from "./types.ts";

import { expect, suite, test } from "vitest";

import { TagikonError } from "../../core/errors.ts";
import { PermissionMismatchError } from "../../security/permission.ts";
import { use } from "./use.ts";

suite("use()", () => {
	suite("permission matching", () => {
		test("succeeds when declared and acknowledged permissions match exactly", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read", "relation:read"] },
			};
			expect(() => use(extension, { permissions: ["tag:read", "relation:read"] })).not.toThrow();
		});

		test("succeeds when extension has no permissions and none are acknowledged", () => {
			expect(() => use({})).not.toThrow();
		});

		test("succeeds when extension has no permissions and empty array is acknowledged", () => {
			expect(() => use({}, { permissions: [] })).not.toThrow();
		});

		test("throws PermissionMismatchError when extension declares permissions but none are acknowledged", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(extension)).toThrow(PermissionMismatchError);
		});

		test("throws PermissionMismatchError when acknowledged permissions are a subset of declared", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read", "relation:read"] },
			};
			expect(() => use(extension, { permissions: ["tag:read"] })).toThrow(PermissionMismatchError);
		});

		test("throws PermissionMismatchError when acknowledged permissions are a superset of declared", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(extension, { permissions: ["tag:read", "relation:read"] })).toThrow(
				PermissionMismatchError,
			);
		});

		test("PermissionMismatchError is a TagikonError", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(extension)).toThrow(TagikonError);
		});

		test("error carries declared and acknowledged permissions", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			try {
				use(extension, { permissions: ["relation:read"] });
				expect.unreachable();
			} catch (e) {
				expect(e).toBeInstanceOf(PermissionMismatchError);
				const err = e as PermissionMismatchError;
				expect(err.declared).toContain("tag:read");
				expect(err.acknowledged).toContain("relation:read");
			}
		});
	});

	suite("return value", () => {
		test("returns a frozen ExtensionRegistration", () => {
			const registration = use({});
			expect(Object.isFrozen(registration)).toBe(true);
		});

		test("carries the extension reference", () => {
			const extension: Extension<Tag> = {};
			const registration = use(extension);
			expect(registration.extension).toBe(extension);
		});

		test("carries the acknowledged permissions", () => {
			const extension: Extension<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			const registration = use(extension, { permissions: ["tag:read"] });
			expect(registration.permissions).toContain("tag:read");
		});
	});
});
