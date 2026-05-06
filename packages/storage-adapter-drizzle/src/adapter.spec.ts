import type { Tag } from "@tagikon/core";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { createClient } from "@libsql/client";
import {
	TagNotFoundError,
	and,
	complementTags,
	intersectTags,
	not,
	objectKey,
	or,
	propertyEqual,
	propertyGreaterThan,
	propertyStartsWith,
	taggedWithAll,
	taggedWithAny,
	tagsById,
	tagsWhere,
	tpc,
	unionTags,
} from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, expect, suite, test } from "vitest";

import { DrizzleStorageAdapter } from "./adapter.ts";
import { createTagikonSqliteSchema } from "./schema.ts";

interface TagWithLabel extends Tag<Uuid> {
	readonly label: string;
}

const setupAdapter = async () => {
	const client = createClient({ url: ":memory:" });

	await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
	await client.execute(
		"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
	);
	await client.execute(
		"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
	);

	const db = drizzle(client);
	const schema = createTagikonSqliteSchema();
	const adapter = new DrizzleStorageAdapter<TagWithLabel>(db, schema);
	adapter.setIdProvider(UUID_ID_PROVIDER);
	return adapter;
};

suite("DrizzleStorageAdapter", () => {
	suite("createTag", () => {
		test("creates a tag and returns it with generated id", async () => {
			const adapter = await setupAdapter();

			const tag = await adapter.createTag({ label: "work" });

			expect(tag.label).toBe("work");
			expect(typeof tag.id).toBe("string");
			expect(tag.id.length).toBeGreaterThan(0);
		});

		test("persists the tag so getTag can retrieve it", async () => {
			const adapter = await setupAdapter();
			const created = await adapter.createTag({ label: "persist-me" });
			const fetched = await adapter.getTag(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched).toEqual({
				label: "persist-me",
				id: created.id,
			});
		});
	});

	suite("getTag", () => {
		test("returns null for non-existent id", async () => {
			const adapter = await setupAdapter();
			const result = await adapter.getTag(UUID_ID_PROVIDER.generate());
			expect(result).toBeNull();
		});
	});

	suite("listTags", () => {
		test("returns empty array when no tags exist", async () => {
			const adapter = await setupAdapter();
			const tags = await adapter.listTags();
			expect(tags).toEqual([]);
		});

		test("returns all created tags", async () => {
			const adapter = await setupAdapter();

			await adapter.createTag({ label: "a" });
			await adapter.createTag({ label: "b" });
			await adapter.createTag({ label: "c" });

			const tags = await adapter.listTags();

			expect(tags).toHaveLength(3);
			expect(tags.map((t) => t.label).sort()).toEqual(["a", "b", "c"]);
		});
	});

	suite("updateTag", () => {
		test("updates tag attributes", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "old" });

			const updated = await adapter.updateTag(tag.id, { label: "new" });

			expect(updated).toEqual({
				label: "new",
				id: tag.id,
			});
		});

		test("persists the update", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "before" });

			await adapter.updateTag(tag.id, { label: "after" });

			const fetched = await adapter.getTag(tag.id);
			expect(fetched!.label).toBe("after");
		});

		test("throws TagNotFoundError for non-existent id", async () => {
			const adapter = await setupAdapter();
			const fakeId = UUID_ID_PROVIDER.generate();
			await expect(adapter.updateTag(fakeId, { label: "x" })).rejects.toThrow(TagNotFoundError);
		});
	});

	suite("deleteTag", () => {
		test("deletes the tag and returns true", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "bye" });

			const result = await adapter.deleteTag(tag.id);

			expect(result).toBe(true);
			const deleted = await adapter.getTag(tag.id);
			expect(deleted).toBeNull();
		});

		test("returns false for non-existent id", async () => {
			const adapter = await setupAdapter();

			const fakeId = UUID_ID_PROVIDER.generate();
			const result = await adapter.deleteTag(fakeId);

			expect(result).toBe(false);
		});

		test("cleans up relations when deleting a tag", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "to-delete" });
			const key = objectKey("file-1");
			await adapter.addRelations(tag.id, [key]);

			await adapter.deleteTag(tag.id);

			const foundTags = await adapter.listObjectTags(key);
			expect(foundTags).toEqual([]);
		});
	});

	suite("addRelations", () => {
		test("links a tag to multiple objects", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "photo" });
			const keys = [objectKey("img-1"), objectKey("img-2"), objectKey("img-3")];

			await adapter.addRelations(tag.id, keys);

			const objects = await adapter.listTagObjects(tag.id);
			expect(objects.sort()).toEqual(keys.sort());
		});

		test("ignores duplicate relations", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "dup" });
			const key = objectKey("doc-1");

			await adapter.addRelations(tag.id, [key]);
			await adapter.addRelations(tag.id, [key]);

			const foundObjects = await adapter.listTagObjects(tag.id);
			expect(foundObjects).toHaveLength(1);
		});

		test("does nothing for empty objectKeys array", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "empty" });
			await expect(adapter.addRelations(tag.id, [])).resolves.toBeUndefined();
		});
	});

	suite("removeRelations", () => {
		test("removes specified relations", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "multi" });
			const keys = [objectKey("a"), objectKey("b"), objectKey("c")];
			await adapter.addRelations(tag.id, keys);

			await adapter.removeRelations(tag.id, [objectKey("a"), objectKey("c")]);

			const foundObjects = await adapter.listTagObjects(tag.id);
			expect(foundObjects).toEqual([objectKey("b")]);
		});

		test("does nothing for empty objectKeys array", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "noop" });
			await adapter.addRelations(tag.id, [objectKey("x")]);

			const result = await adapter.removeRelations(tag.id, []);

			expect(result).toBeUndefined();
			expect(await adapter.listTagObjects(tag.id)).toHaveLength(1);
		});
	});

	suite("listObjectTags", () => {
		test("returns tag ids for a tagged object", async () => {
			const adapter = await setupAdapter();

			const tag1 = await adapter.createTag({ label: "t1" });
			const tag2 = await adapter.createTag({ label: "t2" });

			const key = objectKey("shared-file");

			await adapter.addRelations(tag1.id, [key]);
			await adapter.addRelations(tag2.id, [key]);

			const result = await adapter.listObjectTags(key);

			expect(result).toHaveLength(2);
			expect(result).toContain(tag1.id);
			expect(result).toContain(tag2.id);
		});

		test("returns empty array for untagged object", async () => {
			const adapter = await setupAdapter();
			const key = objectKey("untagged");

			const result = await adapter.listObjectTags(key);

			expect(result).toEqual([]);
		});
	});

	suite("listTagObjects", () => {
		test("returns object keys for a tag", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "docs" });
			const keys = [objectKey("doc-a"), objectKey("doc-b")];
			await adapter.addRelations(tag.id, keys);

			const result = await adapter.listTagObjects(tag.id);

			expect(result.sort()).toEqual(keys.sort());
		});

		test("returns empty array for tag with no objects", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "empty-tag" });

			const result = await adapter.listTagObjects(tag.id);

			expect(result).toEqual([]);
		});
	});

	suite("getAuxStore", () => {
		test("returns the same store instance for the same symbol", async () => {
			const adapter = await setupAdapter();
			const sym = Symbol("ext");
			expect(adapter.getAuxStore(sym)).toBe(adapter.getAuxStore(sym));
		});

		test("find returns null for missing key", async () => {
			const adapter = await setupAdapter();

			const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-find"));
			const tag = await adapter.createTag({ label: "x" });

			const result = await store.find(tag.id);
			expect(result).toBeNull();
		});

		test("put stores and find retrieves data", async () => {
			const adapter = await setupAdapter();

			const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-put"));

			const tag = await adapter.createTag({ label: "x" });
			await store.put(tag.id, { count: 42 });

			const found = await store.find(tag.id);
			expect(found).toEqual({ count: 42 });
		});

		test("put overwrites existing data", async () => {
			const adapter = await setupAdapter();

			const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-overwrite"));

			const tag = await adapter.createTag({ label: "x" });

			await store.put(tag.id, { count: 1 });
			await store.put(tag.id, { count: 99 });

			const found = await store.find(tag.id);
			expect(found).toEqual({ count: 99 });
		});

		test("patch merges with existing data", async () => {
			const adapter = await setupAdapter();

			const store = adapter.getAuxStore<{ a: number; b: string }>(Symbol("ext-patch"));

			const tag = await adapter.createTag({ label: "x" });
			await store.put(tag.id, { a: 1, b: "hello" });

			const result = await store.patch(tag.id, { a: 2 });

			expect(result).toEqual({ a: 2, b: "hello" });
			const found = await store.find(tag.id);
			expect(found).toEqual({ a: 2, b: "hello" });
		});

		test("patch returns null for missing key", async () => {
			const adapter = await setupAdapter();
			const store = adapter.getAuxStore<{ x: number }>(Symbol("ext-patch-null"));
			const tag = await adapter.createTag({ label: "x" });

			const result = await store.patch(tag.id, { x: 5 });

			expect(result).toBeNull();
		});

		test("delete removes data and returns true", async () => {
			const adapter = await setupAdapter();
			const store = adapter.getAuxStore<{ v: number }>(Symbol("ext-delete"));
			const tag = await adapter.createTag({ label: "x" });
			await store.put(tag.id, { v: 7 });

			const result = await store.delete(tag.id);

			expect(result).toBe(true);
			const found = await store.find(tag.id);
			expect(found).toBeNull();
		});

		test("delete returns false for missing key", async () => {
			const adapter = await setupAdapter();
			const store = adapter.getAuxStore<{ v: number }>(Symbol("ext-delete-false"));
			const tag = await adapter.createTag({ label: "x" });

			const result = await store.delete(tag.id);

			expect(result).toBe(false);
		});

		test("list returns all entries for the extension", async () => {
			const adapter = await setupAdapter();
			const store = adapter.getAuxStore<{ rank: number }>(Symbol("ext-list"));

			const tag1 = await adapter.createTag({ label: "t1" });
			const tag2 = await adapter.createTag({ label: "t2" });

			await store.put(tag1.id, { rank: 1 });
			await store.put(tag2.id, { rank: 2 });

			const result = await store.list();

			expect(result).toHaveLength(2);
			expect(result.map(([, d]) => d.rank).sort((a, b) => a - b)).toEqual([1, 2]);
		});

		test("isolates data between different extension symbols", async () => {
			const adapter = await setupAdapter();
			const storeA = adapter.getAuxStore<{ val: string }>(Symbol("ext-iso-a"));
			const storeB = adapter.getAuxStore<{ val: string }>(Symbol("ext-iso-b"));
			const tag = await adapter.createTag({ label: "shared" });
			await storeA.put(tag.id, { val: "from-a" });

			const foundB = await storeB.find(tag.id);

			expect(foundB).toBeNull();
			expect(await storeA.find(tag.id)).toEqual({ val: "from-a" });
		});
	});

	suite("integration", () => {
		let adapter: DrizzleStorageAdapter<TagWithLabel>;

		beforeEach(async () => {
			adapter = await setupAdapter();
		});

		test("bidirectional relation lookup", async () => {
			const tag1 = await adapter.createTag({ label: "work" });
			const tag2 = await adapter.createTag({ label: "urgent" });
			const fileKey = objectKey("report.pdf");
			const docKey = objectKey("memo.txt");

			await adapter.addRelations(tag1.id, [fileKey, docKey]);
			await adapter.addRelations(tag2.id, [fileKey]);

			expect((await adapter.listTagObjects(tag1.id)).sort()).toEqual([fileKey, docKey].sort());
			expect(await adapter.listTagObjects(tag2.id)).toEqual([fileKey]);
			expect((await adapter.listObjectTags(fileKey)).sort()).toEqual([tag1.id, tag2.id].sort());
			expect(await adapter.listObjectTags(docKey)).toEqual([tag1.id]);
		});

		test("removeRelations only removes specified links", async () => {
			const tag = await adapter.createTag({ label: "cleanup" });
			const keys = [objectKey("f1"), objectKey("f2"), objectKey("f3")];
			await adapter.addRelations(tag.id, keys);
			await adapter.removeRelations(tag.id, [objectKey("f2")]);

			const result = await adapter.listTagObjects(tag.id);

			expect(result.sort()).toEqual([objectKey("f1"), objectKey("f3")].sort());
		});
	});

	suite("findObjects / countObjects", () => {
		test("findObjects returns lexicographically sorted matching keys", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "work" });
			await adapter.addRelations(tag.id, [objectKey("c"), objectKey("a"), objectKey("b")]);
			const result = await adapter.findObjects(taggedWithAny(tagsById([tag.id])));
			expect(result).toEqual([objectKey("a"), objectKey("b"), objectKey("c")]);
		});

		test("findObjects with taggedWithAll intersects matching tags", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "work" });
			const t2 = await adapter.createTag({ label: "urgent" });

			await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
			await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);

			const result = await adapter.findObjects(taggedWithAll(tagsById([t1.id, t2.id])));

			expect(result).toEqual([objectKey("b")]);
		});

		test("countObjects returns total matching count", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "work" });
			await adapter.addRelations(tag.id, [objectKey("a"), objectKey("b")]);

			const result = await adapter.countObjects(taggedWithAny(tagsById([tag.id])));

			expect(result).toBe(2);
		});

		test("findObjects with tagsWhere string equal predicate", async () => {
			const adapter = await setupAdapter();

			const work = await adapter.createTag({ label: "work" });
			const home = await adapter.createTag({ label: "home" });

			await adapter.addRelations(work.id, [objectKey("a"), objectKey("b")]);
			await adapter.addRelations(home.id, [objectKey("c")]);

			const result = await adapter.findObjects(
				taggedWithAny(tagsWhere(propertyEqual("label", "work"))),
			);

			expect(result).toEqual([objectKey("a"), objectKey("b")]);
		});

		test("findObjects with tagsWhere starts-with predicate", async () => {
			const adapter = await setupAdapter();

			const work = await adapter.createTag({ label: "work" });
			const workUrgent = await adapter.createTag({ label: "work-urgent" });
			const home = await adapter.createTag({ label: "home" });

			await adapter.addRelations(work.id, [objectKey("a")]);
			await adapter.addRelations(workUrgent.id, [objectKey("b")]);
			await adapter.addRelations(home.id, [objectKey("c")]);

			const result = await adapter.findObjects(
				taggedWithAny(tagsWhere(propertyStartsWith("label", "work"))),
			);

			expect(result).toEqual([objectKey("a"), objectKey("b")]);
		});

		test("findObjects with tagsWhere numeric greater-than predicate", async () => {
			// Use a separate adapter with a numeric field so json_extract returns a JSON number
			const client = createClient({ url: ":memory:" });
			await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
			await client.execute(
				"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
			);
			await client.execute(
				"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
			);
			type TagWithScore = Tag<Uuid> & { score: number };
			const numAdapter = new DrizzleStorageAdapter<TagWithScore>(
				drizzle(client),
				createTagikonSqliteSchema(),
			);
			numAdapter.setIdProvider(UUID_ID_PROVIDER);

			const t1 = await numAdapter.createTag({ score: 1 });
			const t5 = await numAdapter.createTag({ score: 5 });
			const t10 = await numAdapter.createTag({ score: 10 });

			await numAdapter.addRelations(t1.id, [objectKey("obj-1")]);
			await numAdapter.addRelations(t5.id, [objectKey("obj-5")]);
			await numAdapter.addRelations(t10.id, [objectKey("obj-10")]);

			const result = await numAdapter.findObjects(
				taggedWithAny(tagsWhere(propertyGreaterThan("score", 4))),
			);

			expect(result.sort()).toEqual([objectKey("obj-5"), objectKey("obj-10")].sort());
		});

		test("findObjects with and query", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "t1" });
			const t2 = await adapter.createTag({ label: "t2" });

			await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
			await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);

			const result = await adapter.findObjects(
				and([taggedWithAny(tagsById([t1.id])), taggedWithAny(tagsById([t2.id]))]),
			);

			expect(result).toEqual([objectKey("b")]);
		});

		test("findObjects with or query", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "t1" });
			const t2 = await adapter.createTag({ label: "t2" });

			await adapter.addRelations(t1.id, [objectKey("a")]);
			await adapter.addRelations(t2.id, [objectKey("c")]);

			const result = await adapter.findObjects(
				or([taggedWithAny(tagsById([t1.id])), taggedWithAny(tagsById([t2.id]))]),
			);

			expect(result).toEqual([objectKey("a"), objectKey("c")]);
		});

		test("findObjects with not query excludes matched objects", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "t1" });
			const t2 = await adapter.createTag({ label: "t2" });

			await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
			await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);

			const result = await adapter.findObjects(not(taggedWithAny(tagsById([t2.id]))));

			expect(result).toEqual([objectKey("a")]);
		});

		test("findObjects with intersectTags selector", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "work" });
			const t2 = await adapter.createTag({ label: "urgent" });
			const t3 = await adapter.createTag({ label: "home" });

			await adapter.addRelations(t1.id, [objectKey("a")]);
			await adapter.addRelations(t2.id, [objectKey("a")]);
			await adapter.addRelations(t3.id, [objectKey("b")]);

			// intersectTags([tagsById([t1, t2])]) = tags that are both t1 and t2
			const result = await adapter.findObjects(
				taggedWithAny(intersectTags([tagsById([t1.id, t2.id]), tagsById([t1.id, t3.id])])),
			);

			expect(result).toEqual([objectKey("a")]);
		});

		test("findObjects with unionTags selector", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "t1" });
			const t2 = await adapter.createTag({ label: "t2" });

			await adapter.addRelations(t1.id, [objectKey("a")]);
			await adapter.addRelations(t2.id, [objectKey("b")]);

			const result = await adapter.findObjects(
				taggedWithAny(unionTags([tagsById([t1.id]), tagsById([t2.id])])),
			);

			expect(result).toEqual([objectKey("a"), objectKey("b")]);
		});

		test("findObjects with complementTags selector", async () => {
			const adapter = await setupAdapter();

			const t1 = await adapter.createTag({ label: "t1" });
			const t2 = await adapter.createTag({ label: "t2" });

			await adapter.addRelations(t1.id, [objectKey("a")]);
			await adapter.addRelations(t2.id, [objectKey("b")]);

			// complementTags(tagsById([t1])) = all tags except t1 = {t2}
			const result = await adapter.findObjects(taggedWithAny(complementTags(tagsById([t1.id]))));

			expect(result).toEqual([objectKey("b")]);
		});

		test("findObjects applies limit and offset", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "page" });
			await adapter.addRelations(tag.id, [
				objectKey("a"),
				objectKey("b"),
				objectKey("c"),
				objectKey("d"),
				objectKey("e"),
			]);

			const page1 = await adapter.findObjects(taggedWithAny(tagsById([tag.id])), {
				limit: 2,
				offset: 0,
			});
			const page2 = await adapter.findObjects(taggedWithAny(tagsById([tag.id])), {
				limit: 2,
				offset: 2,
			});

			expect(page1).toEqual([objectKey("a"), objectKey("b")]);
			expect(page2).toEqual([objectKey("c"), objectKey("d")]);
		});

		test("findObjects with empty tagsById returns empty result", async () => {
			const adapter = await setupAdapter();
			const tag = await adapter.createTag({ label: "x" });
			await adapter.addRelations(tag.id, [objectKey("a")]);

			const result = await adapter.findObjects(taggedWithAny(tagsById([])));

			expect(result).toEqual([]);
		});

		test("countObjects returns 0 for empty result", async () => {
			const adapter = await setupAdapter();

			const result = await adapter.countObjects(taggedWithAny(tagsById([])));

			expect(result).toBe(0);
		});
	});
});

suite("DrizzleStorageAdapter - codec round-trips", () => {
	const makeAdapterWithBigint = async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
		await client.execute(
			"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
		);
		await client.execute(
			"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
		);
		type TagWithAmount = Tag<Uuid> & { readonly amount: bigint };
		const adapter = new DrizzleStorageAdapter<TagWithAmount>(
			drizzle(client),
			createTagikonSqliteSchema(),
		);
		adapter.setIdProvider(UUID_ID_PROVIDER);
		adapter.setTagCodec({ id: UUID_ID_PROVIDER, amount: tpc.bigint() });
		return adapter;
	};

	test("bigint tag property survives createTag → getTag round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		const tag = await adapter.createTag({ amount: 1_000_000_000_000n });

		const result = await adapter.getTag(tag.id);

		expect(result!.amount).toBe(1_000_000_000_000n);
		expect(typeof result!.amount).toBe("bigint");
	});

	test("bigint tag property survives updateTag → getTag round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		const tag = await adapter.createTag({ amount: 1n });
		await adapter.updateTag(tag.id, { amount: 9999n });

		const result = await adapter.getTag(tag.id);

		expect(result!.amount).toBe(9999n);
	});

	test("bigint tag property survives listTags round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		await adapter.createTag({ amount: 42n });
		await adapter.createTag({ amount: 100n });

		const result = await adapter.listTags();

		expect(result).toHaveLength(2);
		expect(result.every((t) => typeof t.amount === "bigint")).toBe(true);
	});

	test("propertyEqual with bigint value queries correctly", async () => {
		const adapter = await makeAdapterWithBigint();
		const t1 = await adapter.createTag({ amount: 1000n });
		const t2 = await adapter.createTag({ amount: 2000n });

		await adapter.addRelations(t1.id, [objectKey("obj1")]);
		await adapter.addRelations(t2.id, [objectKey("obj2")]);

		const result = await adapter.findObjects(
			taggedWithAny(tagsWhere(propertyEqual("amount", 1000n))),
		);

		expect(result).toEqual([objectKey("obj1")]);
	});

	test("aux store with custom AuxCodec round-trips custom class", async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
		await client.execute(
			"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
		);
		await client.execute(
			"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
		);

		const adapter = new DrizzleStorageAdapter<TagWithLabel>(
			drizzle(client),
			createTagikonSqliteSchema(),
		);
		adapter.setIdProvider(UUID_ID_PROVIDER);

		const EXT = Symbol("custom-codec-ext");
		const store = adapter.getAuxStore<{ count: number }>(EXT, {
			serialize: (data) => JSON.stringify(data),
			deserialize: (raw) => JSON.parse(raw) as { count: number },
		});

		const tag = await adapter.createTag({ label: "x" });
		await store.put(tag.id, { count: 99 });

		const result = await store.find(tag.id);

		expect(result).toEqual({ count: 99 });
	});
});

suite("DrizzleStorageAdapter – prototype pollution safety", () => {
	test("__proto__ key in stored tag data does not pollute Object prototype", async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
		await client.execute(
			"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
		);
		await client.execute(
			"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
		);
		const db = drizzle(client);
		const schema = createTagikonSqliteSchema();
		const adapter = new DrizzleStorageAdapter<TagWithLabel>(db, schema);
		adapter.setIdProvider(UUID_ID_PROVIDER);

		const tag = await adapter.createTag({ label: "safe" });

		// Manually inject a poisoned row into the DB to simulate an attacker-controlled value
		await client.execute({
			sql: `UPDATE tagikon_tags SET data = ? WHERE id = ?`,
			args: [`{"label":"safe","__proto__":{"poisoned":true}}`, tag.id as string],
		});

		const result = await adapter.getTag(tag.id);

		expect(result).not.toBeNull();
		// safeJsonParse must have stripped __proto__ so Object.prototype is clean
		expect((Object.prototype as Record<string, unknown>)["poisoned"]).toBeUndefined();
	});
});
