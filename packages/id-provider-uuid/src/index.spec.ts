import { expect, suite, test } from "vitest";

import { UUID_ID_PROVIDER } from "./index.ts";

suite("UUID_ID_PROVIDER", () => {
	test("generate returns a UUID-shaped string", () => {
		const id = UUID_ID_PROVIDER.generate();
		expect(typeof id).toBe("string");
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	test("serialize is identity for string ids", () => {
		const id = UUID_ID_PROVIDER.generate();
		expect(UUID_ID_PROVIDER.serialize(id)).toBe(id);
	});

	test("deserialize roundtrips with serialize", () => {
		const id = UUID_ID_PROVIDER.generate();
		expect(UUID_ID_PROVIDER.deserialize(UUID_ID_PROVIDER.serialize(id))).toBe(id);
	});
});
