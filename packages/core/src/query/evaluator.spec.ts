import type { ObjectKey } from "../core/ids.ts";
import type { Tag } from "../core/tag.ts";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import { objectKey } from "../core/ids.ts";
import {
	and,
	complementTags,
	intersectTags,
	not,
	or,
	propertyContains,
	propertyEndsWith,
	propertyEqual,
	propertyGreaterThan,
	propertyGreaterThanOrEqual,
	propertyLessThan,
	propertyLessThanOrEqual,
	propertyStartsWith,
	taggedWithAll,
	taggedWithAny,
	tagsById,
	tagsWhere,
	unionTags,
} from "./builders.ts";
import { countObjectQueryInMemory, evaluateObjectQueryInMemory } from "./evaluator.ts";

interface TagWithName extends Tag<Uuid> {
	readonly name: string;
}

interface TagWithScore extends Tag<Uuid> {
	readonly score: number;
}

const assertSameSet = (actual: readonly ObjectKey[], expected: readonly ObjectKey[]) => {
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);
	for (const key of expectedSet) expect(actualSet).toContain(key);
	expect(actual.length).toBe(expected.length);
};

/**
 * - obj1: tag-a, tag-b
 * - obj2: tag-b, tag-c
 * - obj3: tag-a
 */
const setupHas = async () => {
	const storage = new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER);
	const tags = {
		a: await storage.createTag({ name: "a" }),
		b: await storage.createTag({ name: "b" }),
		c: await storage.createTag({ name: "c" }),
	};

	await storage.addRelations(tags.a.id, [objectKey("obj1"), objectKey("obj3")]);
	await storage.addRelations(tags.b.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.c.id, [objectKey("obj2")]);

	return { storage, tags };
};

/**
 * - name="foo": obj1, obj2
 * - name="foobar": obj2, obj3
 * - name="bar": obj3
 */
const setupStringTags = async () => {
	const storage = new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER);
	const tags = {
		foo: await storage.createTag({ name: "foo" }),
		foobar: await storage.createTag({ name: "foobar" }),
		bar: await storage.createTag({ name: "bar" }),
	};

	await storage.addRelations(tags.foo.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.foobar.id, [objectKey("obj2"), objectKey("obj3")]);
	await storage.addRelations(tags.bar.id, [objectKey("obj3")]);

	return { storage, tags };
};

/**
 * - score=10: obj1
 * - score=20: obj1, obj2
 * - score=30: obj2, obj3
 */
const setupScoreTags = async () => {
	const storage = new MapStorageAdapter<TagWithScore>(UUID_ID_PROVIDER);
	const tags = {
		low: await storage.createTag({ score: 10 }),
		mid: await storage.createTag({ score: 20 }),
		high: await storage.createTag({ score: 30 }),
	};

	await storage.addRelations(tags.low.id, [objectKey("obj1")]);
	await storage.addRelations(tags.mid.id, [objectKey("obj1"), objectKey("obj2")]);
	await storage.addRelations(tags.high.id, [objectKey("obj2"), objectKey("obj3")]);

	return { storage, tags };
};

suite("evaluateObjectQueryInMemory", () => {
	suite("taggedWithAny / taggedWithAll over tagsById", () => {
		test("taggedWithAny: union of tag-matched objects", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(tagsById([tags.a.id, tags.c.id])),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("taggedWithAll: intersection of tag-matched objects", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAll(tagsById([tags.a.id, tags.b.id])),
				storage,
			);
			assertSameSet(result, [objectKey("obj1")]);
		});

		test("taggedWithAny: empty selector returns []", async () => {
			const { storage } = await setupHas();
			const result = await evaluateObjectQueryInMemory(taggedWithAny(tagsById([])), storage);
			expect(result).toHaveLength(0);
		});

		test("taggedWithAll: empty selector returns []", async () => {
			const { storage } = await setupHas();
			const result = await evaluateObjectQueryInMemory(taggedWithAll(tagsById([])), storage);
			expect(result).toHaveLength(0);
		});
	});

	suite("and / or / not", () => {
		test("and: intersection across queries", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				and([taggedWithAny(tagsById([tags.a.id])), taggedWithAny(tagsById([tags.b.id]))]),
				storage,
			);
			assertSameSet(result, [objectKey("obj1")]);
		});

		test("or: union across queries", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				or([taggedWithAny(tagsById([tags.a.id])), taggedWithAny(tagsById([tags.c.id]))]),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("not: excludes matched objects from the universe of tagged objects", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				not(taggedWithAny(tagsById([tags.a.id]))),
				storage,
			);
			assertSameSet(result, [objectKey("obj2")]);
		});

		test("and with empty queries returns []", async () => {
			const { storage } = await setupHas();
			expect(await evaluateObjectQueryInMemory(and<Uuid>([]), storage)).toHaveLength(0);
		});

		test("or with empty queries returns []", async () => {
			const { storage } = await setupHas();
			expect(await evaluateObjectQueryInMemory(or<Uuid>([]), storage)).toHaveLength(0);
		});

		test("nested: and(any, not(any))", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				and([taggedWithAny(tagsById([tags.a.id])), not(taggedWithAny(tagsById([tags.b.id])))]),
				storage,
			);
			assertSameSet(result, [objectKey("obj3")]);
		});
	});

	suite("tagsWhere with property predicates", () => {
		test("equal", async () => {
			const { storage } = await setupStringTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyEqual("name", "foo"))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2")]);
		});

		test("contains", async () => {
			const { storage } = await setupStringTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyContains("name", "oo"))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("starts-with", async () => {
			const { storage } = await setupStringTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyStartsWith("name", "foo"))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("ends-with", async () => {
			const { storage } = await setupStringTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyEndsWith("name", "bar"))),
				storage,
			);
			assertSameSet(result, [objectKey("obj2"), objectKey("obj3")]);
		});

		test("greater-than", async () => {
			const { storage } = await setupScoreTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyGreaterThan("score", 15))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("less-than", async () => {
			const { storage } = await setupScoreTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyLessThan("score", 25))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2")]);
		});

		test("greater-than-or-equal includes exact matches", async () => {
			const { storage } = await setupScoreTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyGreaterThanOrEqual("score", 20))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("less-than-or-equal includes exact matches", async () => {
			const { storage } = await setupScoreTags();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(tagsWhere(propertyLessThanOrEqual("score", 20))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2")]);
		});
	});

	suite("TagSelector composition", () => {
		test("intersectTags: tags matched by both selectors", async () => {
			const { storage, tags } = await setupStringTags();
			// names containing "oo": foo, foobar — names ending with "bar": foobar, bar — intersection: foobar
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny<Uuid>(
					intersectTags([
						tagsWhere(propertyContains("name", "oo")),
						tagsWhere(propertyEndsWith("name", "bar")),
					]),
				),
				storage,
			);
			assertSameSet(result, [objectKey("obj2"), objectKey("obj3")]);
			// foobar tags obj2 + obj3
			expect(result).toHaveLength(2);
			void tags;
		});

		test("unionTags: union of two selectors", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(unionTags([tagsById([tags.a.id]), tagsById([tags.c.id])])),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("complementTags: tags excluded from a selector", async () => {
			const { storage, tags } = await setupHas();
			// complement of {a} = {b, c}; tagged-with-any({b, c}) = obj1, obj2
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(complementTags(tagsById([tags.a.id]))),
				storage,
			);
			assertSameSet(result, [objectKey("obj1"), objectKey("obj2")]);
		});
	});

	suite("limit / offset", () => {
		test("returns lexicographically sorted object keys", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(tagsById([tags.a.id, tags.b.id, tags.c.id])),
				storage,
			);
			expect(result).toEqual([objectKey("obj1"), objectKey("obj2"), objectKey("obj3")]);
		});

		test("limit truncates the result", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(tagsById([tags.a.id, tags.b.id, tags.c.id])),
				storage,
				{ limit: 2 },
			);
			expect(result).toEqual([objectKey("obj1"), objectKey("obj2")]);
		});

		test("offset skips entries", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(tagsById([tags.a.id, tags.b.id, tags.c.id])),
				storage,
				{ offset: 1 },
			);
			expect(result).toEqual([objectKey("obj2"), objectKey("obj3")]);
		});

		test("limit + offset combine", async () => {
			const { storage, tags } = await setupHas();
			const result = await evaluateObjectQueryInMemory(
				taggedWithAny(tagsById([tags.a.id, tags.b.id, tags.c.id])),
				storage,
				{ offset: 1, limit: 1 },
			);
			expect(result).toEqual([objectKey("obj2")]);
		});
	});
});

suite("countObjectQueryInMemory", () => {
	test("counts matching objects", async () => {
		const { storage, tags } = await setupHas();
		const count = await countObjectQueryInMemory(taggedWithAny(tagsById([tags.a.id])), storage);
		expect(count).toBe(2);
	});

	test("returns 0 for empty selector", async () => {
		const { storage } = await setupHas();
		const count = await countObjectQueryInMemory(taggedWithAny(tagsById([])), storage);
		expect(count).toBe(0);
	});

	test("does not apply limit/offset", async () => {
		const { storage, tags } = await setupHas();
		const count = await countObjectQueryInMemory(
			taggedWithAny(tagsById([tags.a.id, tags.b.id, tags.c.id])),
			storage,
		);
		expect(count).toBe(3);
	});
});
