import type { Tag } from "../core/tag.ts";
import type { TaginkonPlugin } from "./types.ts";

import { expect, suite, test } from "vitest";

import { TaginkonError } from "../core/errors.ts";
import { PermissionMismatchError } from "../security/permission.ts";
import { use } from "./use.ts";

suite("use()", () => {
	suite("permission matching", () => {
		test("succeeds when declared and acknowledged permissions match exactly", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read", "relation:read"] },
			};
			expect(() => use(plugin, { permissions: ["tag:read", "relation:read"] })).not.toThrow();
		});

		test("succeeds when plugin has no permissions and none are acknowledged", () => {
			expect(() => use({})).not.toThrow();
		});

		test("succeeds when plugin has no permissions and empty array is acknowledged", () => {
			expect(() => use({}, { permissions: [] })).not.toThrow();
		});

		test("throws PermissionMismatchError when plugin declares permissions but none are acknowledged", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(plugin)).toThrow(PermissionMismatchError);
		});

		test("throws PermissionMismatchError when acknowledged permissions are a subset of declared", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read", "relation:read"] },
			};
			expect(() => use(plugin, { permissions: ["tag:read"] })).toThrow(PermissionMismatchError);
		});

		test("throws PermissionMismatchError when acknowledged permissions are a superset of declared", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(plugin, { permissions: ["tag:read", "relation:read"] })).toThrow(
				PermissionMismatchError,
			);
		});

		test("PermissionMismatchError is a TaginkonError", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			expect(() => use(plugin)).toThrow(TaginkonError);
		});

		test("error carries declared and acknowledged permissions", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			try {
				use(plugin, { permissions: ["relation:read"] });
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
		test("returns a frozen PluginRegistration", () => {
			const registration = use({});
			expect(Object.isFrozen(registration)).toBe(true);
		});

		test("carries the plugin reference", () => {
			const plugin: TaginkonPlugin<Tag> = {};
			const registration = use(plugin);
			expect(registration.plugin).toBe(plugin);
		});

		test("carries the acknowledged permissions", () => {
			const plugin: TaginkonPlugin<Tag> = {
				permissions: { permissions: ["tag:read"] },
			};
			const registration = use(plugin, { permissions: ["tag:read"] });
			expect(registration.permissions).toContain("tag:read");
		});
	});
});
