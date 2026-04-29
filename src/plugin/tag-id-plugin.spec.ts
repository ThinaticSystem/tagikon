import { expect, suite, test } from "vitest";

import { UUID_TAG_ID_PLUGIN, stringTagIdPlugin } from "./tag-id-plugin.ts";

suite("stringTagIdPlugin", () => {
	test("generate calls the provided factory", () => {
		let n = 0;
		const plugin = stringTagIdPlugin(() => `id-${++n}` as `id-${number}`);
		expect(plugin.generate()).toBe("id-1");
		expect(plugin.generate()).toBe("id-2");
	});

	test("serialize is identity", () => {
		const plugin = stringTagIdPlugin(() => "x");
		expect(plugin.serialize("x")).toBe("x");
	});

	test("deserialize is identity", () => {
		const plugin = stringTagIdPlugin(() => "x");
		expect(plugin.deserialize("hello")).toBe("hello");
	});
});

suite("UUID_TAG_ID_PLUGIN", () => {
	test("generate returns a UUID-shaped string", () => {
		const id = UUID_TAG_ID_PLUGIN.generate();
		expect(typeof id).toBe("string");
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	test("serialize is identity for string ids", () => {
		const id = UUID_TAG_ID_PLUGIN.generate();
		expect(UUID_TAG_ID_PLUGIN.serialize(id)).toBe(id);
	});

	test("deserialize roundtrips with serialize", () => {
		const id = UUID_TAG_ID_PLUGIN.generate();
		expect(UUID_TAG_ID_PLUGIN.deserialize(UUID_TAG_ID_PLUGIN.serialize(id))).toBe(id);
	});
});
