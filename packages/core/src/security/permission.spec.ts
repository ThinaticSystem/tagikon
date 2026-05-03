import { expect, suite, test } from "vitest";

import { ExtensionError, TagikonError } from "../core/errors.ts";
import { PermissionDeniedError, PermissionMismatchError } from "./permission.ts";

suite("PermissionDeniedError", () => {
	test("is a TagikonError", () => {
		expect(new PermissionDeniedError("tag:read")).toBeInstanceOf(TagikonError);
	});

	test("is an ExtensionError", () => {
		expect(new PermissionDeniedError("tag:read")).toBeInstanceOf(ExtensionError);
	});

	test("carries the denied permission", () => {
		expect(new PermissionDeniedError("tag:write").permission).toBe("tag:write");
	});

	test("name is PermissionDeniedError", () => {
		expect(new PermissionDeniedError("relation:read").name).toBe("PermissionDeniedError");
	});
});

suite("PermissionMismatchError", () => {
	test("is a TagikonError", () => {
		expect(new PermissionMismatchError(new Set(["tag:read"]), new Set())).toBeInstanceOf(
			TagikonError,
		);
	});

	test("carries declared and acknowledged sets", () => {
		const err = new PermissionMismatchError(
			new Set(["tag:read", "tag:write"]),
			new Set(["relation:read"]),
		);
		expect(err.declared).toContain("tag:read");
		expect(err.declared).toContain("tag:write");
		expect(err.acknowledged).toContain("relation:read");
	});
});
