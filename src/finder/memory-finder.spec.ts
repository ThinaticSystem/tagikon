import type { ObjectKey } from "../core/ids.ts";

import { expect, suite, test } from "vitest";

import { objectKey } from "../core/ids.ts";
import { MapStorageAdapter } from "../plugins/storage-adapters/map-storage-adapter/index.ts";
import { and, has, not, or } from "./condition.ts";
import { MemoryFinder } from "./memory-finder.ts";

const assertContainsAll = (actual: Iterable<ObjectKey>, expected: Iterable<ObjectKey>) => {
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);

	// NOTE: Set.symmetricDifference().sizeすれば判定できるが、結果がわかりやすいようにループで確認する
	for (const item of expectedSet) {
		expect(actualSet).toContain(item);
	}
	expect(actualSet).toHaveLength(expectedSet.size);
};

/**
 * - obj1: tag-a, tag-b
 * - obj2: tag-b, tag-c
 * - obj3: tag-a
 */
async function setup() {
	const storage = new MapStorageAdapter();

	const tags = {
		a: await storage.createTag({ name: "a" }),
		b: await storage.createTag({ name: "b" }),
		c: await storage.createTag({ name: "c" }),
	};

	await storage.addRelations(tags.a.id, [objectKey("obj1"), objectKey("obj3")]);
	await storage.addRelations(tags.b.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.c.id, [objectKey("obj2")]);

	return { storage, tags, finder: new MemoryFinder() };
}

suite("MemoryFinder", () => {
	test("has: returns objects tagged with the given tag", async () => {
		const { storage, tags, finder } = await setup();
		const result = await finder.findObjectsByTags(has(tags.a.id), storage);

		assertContainsAll(result, [objectKey("obj1"), objectKey("obj3")]);
	});

	test("and: returns intersection of tag-matched objects", async () => {
		const { storage, tags, finder } = await setup();
		const result = await finder.findObjectsByTags(and([has(tags.a.id), has(tags.b.id)]), storage);

		assertContainsAll(result, [objectKey("obj1")]);
	});

	test("or: returns union of tag-matched objects", async () => {
		const { storage, tags, finder } = await setup();
		const result = await finder.findObjectsByTags(or([has(tags.a.id), has(tags.c.id)]), storage);

		assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
	});

	test("not: returns tagged objects not matching the inner condition", async () => {
		const { storage, tags, finder } = await setup();
		const result = await finder.findObjectsByTags(not(has(tags.a.id)), storage);

		// obj1 has a → excluded. obj3 has a → excluded. obj2 has no a → included.
		assertContainsAll(result, [objectKey("obj2")]);
	});

	test("and with empty conditions returns []", async () => {
		const { storage, finder } = await setup();
		const result = await finder.findObjectsByTags(and([]), storage);

		expect(result).toHaveLength(0);
	});

	test("or with empty conditions returns []", async () => {
		const { storage, finder } = await setup();
		const result = await finder.findObjectsByTags(or([]), storage);

		expect(result).toHaveLength(0);
	});

	test("nested: and(has(a), not(has(b)))", async () => {
		const { storage, tags, finder } = await setup();
		// a-tagged: obj1, obj3. not-b: obj3 (obj1 has b, obj2 has b but not a)
		const result = await finder.findObjectsByTags(
			and([has(tags.a.id), not(has(tags.b.id))]),
			storage,
		);

		assertContainsAll(result, [objectKey("obj3")]);
	});
});
