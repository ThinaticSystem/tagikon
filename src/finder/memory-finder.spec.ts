import type { ObjectKey } from "../core/ids.ts";
import type { Tag } from "../core/tag.ts";

import { expect, suite, test } from "vitest";

import { objectKey } from "../core/ids.ts";
import { MapStorageAdapter } from "../plugins/storage-adapters/map-storage-adapter/index.ts";
import {
	and,
	has,
	not,
	or,
	tagProperty,
	tagPropertyContains,
	tagPropertyEndsWith,
	tagPropertyGreaterThan,
	tagPropertyGreaterThanOrEqual,
	tagPropertyLessThan,
	tagPropertyLessThanOrEqual,
	tagPropertyStartsWith,
} from "./condition.ts";
import { MemoryFinder } from "./memory-finder.ts";

interface TagWithName extends Tag {
	readonly name: string;
}

interface TagWithScore extends Tag {
	readonly score: number;
}

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
async function setupHas() {
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

/**
 * Tags with string names:
 * - name="foo": obj1, obj2
 * - name="foobar": obj2, obj3
 * - name="bar": obj3
 */
async function setupStringTags() {
	const storage = new MapStorageAdapter<TagWithName>();
	const finder = new MemoryFinder<TagWithName>();

	const tags = {
		foo: await storage.createTag({ name: "foo" }),
		foobar: await storage.createTag({ name: "foobar" }),
		bar: await storage.createTag({ name: "bar" }),
	};

	await storage.addRelations(tags.foo.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.foobar.id, [objectKey("obj2"), objectKey("obj3")]);
	await storage.addRelations(tags.bar.id, [objectKey("obj3")]);

	return { storage, tags, finder };
}

/**
 * Tags with numeric scores:
 * - score=10: obj1
 * - score=20: obj1, obj2
 * - score=30: obj2, obj3
 */
async function setupScoreTags() {
	const storage = new MapStorageAdapter<TagWithScore>();
	const finder = new MemoryFinder<TagWithScore>();

	const tags = {
		low: await storage.createTag({ score: 10 }),
		mid: await storage.createTag({ score: 20 }),
		high: await storage.createTag({ score: 30 }),
	};

	await storage.addRelations(tags.low.id, [objectKey("obj1")]);
	await storage.addRelations(tags.mid.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.high.id, [objectKey("obj2"), objectKey("obj3")]);

	return { storage, tags, finder };
}

suite("MemoryFinder", () => {
	test("has: returns objects tagged with the given tag", async () => {
		const { storage, tags, finder } = await setupHas();
		const result = await finder.findObjectsByTags(has(tags.a.id), storage);

		assertContainsAll(result, [objectKey("obj1"), objectKey("obj3")]);
	});

	test("and: returns intersection of tag-matched objects", async () => {
		const { storage, tags, finder } = await setupHas();
		const result = await finder.findObjectsByTags(and([has(tags.a.id), has(tags.b.id)]), storage);

		assertContainsAll(result, [objectKey("obj1")]);
	});

	test("or: returns union of tag-matched objects", async () => {
		const { storage, tags, finder } = await setupHas();
		const result = await finder.findObjectsByTags(or([has(tags.a.id), has(tags.c.id)]), storage);

		assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
	});

	test("not: returns tagged objects not matching the inner condition", async () => {
		const { storage, tags, finder } = await setupHas();
		const result = await finder.findObjectsByTags(not(has(tags.a.id)), storage);

		// obj1 has a → excluded. obj3 has a → excluded. obj2 has no a → included.
		assertContainsAll(result, [objectKey("obj2")]);
	});

	test("and with empty conditions returns []", async () => {
		const { storage, finder } = await setupHas();
		const result = await finder.findObjectsByTags(and([]), storage);

		expect(result).toHaveLength(0);
	});

	test("or with empty conditions returns []", async () => {
		const { storage, finder } = await setupHas();
		const result = await finder.findObjectsByTags(or([]), storage);

		expect(result).toHaveLength(0);
	});

	test("nested: and(has(a), not(has(b)))", async () => {
		const { storage, tags, finder } = await setupHas();
		// a-tagged: obj1, obj3. not-b: obj3 (obj1 has b, obj2 has b but not a)
		const result = await finder.findObjectsByTags(
			and([has(tags.a.id), not(has(tags.b.id))]),
			storage,
		);

		assertContainsAll(result, [objectKey("obj3")]);
	});

	suite("tag-property: equal", () => {
		test("matches objects tagged with tags where property === value", async () => {
			const { storage, finder } = await setupStringTags();
			const result = await finder.findObjectsByTags(tagProperty("name", "foo"), storage);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2")]);
		});

		test("returns [] when no tag matches", async () => {
			const { storage, finder } = await setupStringTags();
			const result = await finder.findObjectsByTags(tagProperty("name", "missing"), storage);

			expect(result).toHaveLength(0);
		});

		test("returns [] when property is a number but condition value is string", async () => {
			const { storage, finder } = await setupScoreTags();
			const result = await finder.findObjectsByTags(
				tagProperty("score", "10" as unknown as number),
				storage,
			);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: contains", () => {
		test("matches objects tagged with tags whose string property contains the substring", async () => {
			const { storage, finder } = await setupStringTags();
			// "foo" contains "oo", "foobar" contains "oo" → obj1, obj2, obj3
			const result = await finder.findObjectsByTags(tagPropertyContains("name", "oo"), storage);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("returns [] when no tag name contains the value", async () => {
			const { storage, finder } = await setupStringTags();
			const result = await finder.findObjectsByTags(tagPropertyContains("name", "xyz"), storage);

			expect(result).toHaveLength(0);
		});

		test("returns [] when property is not a string", async () => {
			const { storage, finder } = await setupScoreTags();
			const result = await finder.findObjectsByTags(
				tagPropertyContains("score" as unknown as string, "1"),
				storage,
			);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: starts-with", () => {
		test("matches objects tagged with tags whose property starts with the prefix", async () => {
			const { storage, finder } = await setupStringTags();
			// "foo" and "foobar" start with "foo" → obj1, obj2, obj3
			const result = await finder.findObjectsByTags(tagPropertyStartsWith("name", "foo"), storage);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("returns [] when no tag starts with the prefix", async () => {
			const { storage, finder } = await setupStringTags();
			const result = await finder.findObjectsByTags(tagPropertyStartsWith("name", "baz"), storage);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: ends-with", () => {
		test("matches objects tagged with tags whose property ends with the suffix", async () => {
			const { storage, finder } = await setupStringTags();
			// "foobar" and "bar" end with "bar" → obj2, obj3
			const result = await finder.findObjectsByTags(tagPropertyEndsWith("name", "bar"), storage);

			assertContainsAll(result, [objectKey("obj2"), objectKey("obj3")]);
		});

		test("returns [] when no tag ends with the suffix", async () => {
			const { storage, finder } = await setupStringTags();
			const result = await finder.findObjectsByTags(tagPropertyEndsWith("name", "baz"), storage);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: greater-than", () => {
		test("matches objects tagged with tags whose numeric property is > value", async () => {
			const { storage, finder } = await setupScoreTags();
			// score > 15: mid(20), high(30) → obj1, obj2, obj3
			const result = await finder.findObjectsByTags(tagPropertyGreaterThan("score", 15), storage);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("excludes exact matches (strict greater-than)", async () => {
			const { storage, finder } = await setupScoreTags();
			// score > 20: high(30) → obj2, obj3
			const result = await finder.findObjectsByTags(tagPropertyGreaterThan("score", 20), storage);

			assertContainsAll(result, [objectKey("obj2"), objectKey("obj3")]);
		});

		test("returns [] when no tag exceeds the value", async () => {
			const { storage, finder } = await setupScoreTags();
			const result = await finder.findObjectsByTags(tagPropertyGreaterThan("score", 100), storage);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: less-than", () => {
		test("matches objects tagged with tags whose numeric property is < value", async () => {
			const { storage, finder } = await setupScoreTags();
			// score < 25: low(10), mid(20) → obj1, obj2
			const result = await finder.findObjectsByTags(tagPropertyLessThan("score", 25), storage);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2")]);
		});

		test("excludes exact matches (strict less-than)", async () => {
			const { storage, finder } = await setupScoreTags();
			// score < 20: low(10) → obj1
			const result = await finder.findObjectsByTags(tagPropertyLessThan("score", 20), storage);

			assertContainsAll(result, [objectKey("obj1")]);
		});
	});

	suite("tag-property: greater-than-or-equal", () => {
		test("includes exact matches", async () => {
			const { storage, finder } = await setupScoreTags();
			// score >= 20: mid(20), high(30) → obj1, obj2, obj3
			const result = await finder.findObjectsByTags(
				tagPropertyGreaterThanOrEqual("score", 20),
				storage,
			);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("returns [] when all scores are below the threshold", async () => {
			const { storage, finder } = await setupScoreTags();
			const result = await finder.findObjectsByTags(
				tagPropertyGreaterThanOrEqual("score", 100),
				storage,
			);

			expect(result).toHaveLength(0);
		});
	});

	suite("tag-property: less-than-or-equal", () => {
		test("includes exact matches", async () => {
			const { storage, finder } = await setupScoreTags();
			// score <= 20: low(10), mid(20) → obj1, obj2
			const result = await finder.findObjectsByTags(
				tagPropertyLessThanOrEqual("score", 20),
				storage,
			);

			assertContainsAll(result, [objectKey("obj1"), objectKey("obj2")]);
		});

		test("returns [] when all scores exceed the threshold", async () => {
			const { storage, finder } = await setupScoreTags();
			const result = await finder.findObjectsByTags(
				tagPropertyLessThanOrEqual("score", 5),
				storage,
			);

			expect(result).toHaveLength(0);
		});
	});
});
