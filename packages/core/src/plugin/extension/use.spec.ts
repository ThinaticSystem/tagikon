import type { Tag } from "../../core/tag.ts";
import type { Extension } from "./types.ts";

import { expect, suite, test } from "vitest";

import {
	ExtensionError,
	IllegalExtensionDefinitionError,
	NamespaceNotFoundError,
	TagikonError,
} from "../../core/errors.ts";
import { PermissionMismatchError } from "../../security/permission.ts";
import { use } from "./use.ts";

suite("use()", () => {
	suite("namespace validation", () => {
		test("throws NamespaceNotFoundError when api is defined but namespace is missing", () => {
			const extension = {
				api: { greet: (_ctx: unknown) => "hello" },
			} as unknown as Extension<Tag>;
			expect(() => use(extension)).toThrow(NamespaceNotFoundError);
		});

		test("NamespaceNotFoundError is an IllegalExtensionDefinitionError", () => {
			const extension = { api: { foo: (_ctx: unknown) => 1 } } as unknown as Extension<Tag>;
			expect(() => use(extension)).toThrow(IllegalExtensionDefinitionError);
		});

		test("NamespaceNotFoundError is an ExtensionError", () => {
			const extension = { api: { foo: (_ctx: unknown) => 1 } } as unknown as Extension<Tag>;
			expect(() => use(extension)).toThrow(ExtensionError);
		});

		test("NamespaceNotFoundError is a TagikonError", () => {
			const extension = { api: { foo: (_ctx: unknown) => 1 } } as unknown as Extension<Tag>;
			expect(() => use(extension)).toThrow(TagikonError);
		});

		test("error carries the api key names", () => {
			const extension = {
				api: { foo: (_ctx: unknown) => 1, bar: (_ctx: unknown) => 2 },
			} as unknown as Extension<Tag>;
			try {
				use(extension);
				expect.unreachable();
			} catch (e) {
				expect(e).toBeInstanceOf(NamespaceNotFoundError);
				const err = e as NamespaceNotFoundError;
				expect(err.apiKeys).toContain("foo");
				expect(err.apiKeys).toContain("bar");
			}
		});

		test("succeeds when api is defined with a namespace", () => {
			const NS: unique symbol = Symbol("ns");
			const extension: Extension<Tag, typeof NS, { greet(): string }> = {
				namespace: NS,
				api: { greet: (_ctx) => "hello" },
			};
			expect(() => use(extension)).not.toThrow();
		});

		test("succeeds when api is empty object and namespace is missing", () => {
			expect(() => use({ api: {} })).not.toThrow();
		});
	});

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
