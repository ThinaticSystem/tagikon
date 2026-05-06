import type { Tag } from "../../core/tag.ts";
import type { IdProvider } from "../id-provider/types.ts";
import type { StorageAdapter } from "./types.ts";

import { expect, suite, test } from "vitest";

import { TagNotFoundError } from "../../core/errors.ts";
import { objectKey } from "../../core/ids.ts";
import {
	and,
	complementTags,
	intersectTags,
	not,
	or,
	propertyEqual,
	propertyStartsWith,
	taggedWithAll,
	taggedWithAny,
	tagsById,
	tagsWhere,
	unionTags,
} from "../../query/builders.ts";

/** Standard tag type used in {@link runStorageAdapterTests}. Adapters under test must be initialized with this shape. */
export interface StorageAdapterTestTag extends Tag<string> {
	readonly name: string;
}

/**
 * A simple string {@link IdProvider} suitable for use in tests — generates random UUIDs and
 * serializes them as-is.
 */
export const testIdProvider: IdProvider<string> = {
	generate: () => crypto.randomUUID(),
	serialize: (id) => id,
	deserialize: (raw) => raw,
};

/**
 * Runs the canonical {@link StorageAdapter} contract tests against any adapter implementation.
 *
 * @param suiteName - Top-level suite label (typically the adapter class name).
 * @param createAdapter - Factory called once per test; must return a freshly initialised adapter
 *   with {@link StorageAdapterTestTag} as its tag type.
 *
 * @example
 * ```ts
 * runStorageAdapterTests("MyAdapter", async () =>
 *   new MyAdapter<StorageAdapterTestTag>().initialize({ id: testIdProvider })
 * );
 * ```
 */
export const runStorageAdapterTests = (
	suiteName: string,
	createAdapter: () => Promise<StorageAdapter<StorageAdapterTestTag>>,
): void => {
	suite(suiteName, () => {
		suite("createTag", () => {
			test("creates a tag and returns it with generated id", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "work" });
				expect(tag.name).toBe("work");
				expect(typeof tag.id).toBe("string");
				expect(tag.id.length).toBeGreaterThan(0);
			});

			test("persists the tag so getTag can retrieve it", async () => {
				const adapter = await createAdapter();
				const created = await adapter.createTag({ name: "persist-me" });
				const fetched = await adapter.getTag(created.id);
				expect(fetched).toEqual(created);
			});
		});

		suite("getTag", () => {
			test("returns null for non-existent id", async () => {
				const adapter = await createAdapter();
				const result = await adapter.getTag(crypto.randomUUID());
				expect(result).toBeNull();
			});
		});

		suite("listTags", () => {
			test("returns empty array when no tags exist", async () => {
				const adapter = await createAdapter();
				const tags = await adapter.listTags();
				expect(tags).toEqual([]);
			});

			test("returns all created tags", async () => {
				const adapter = await createAdapter();
				await adapter.createTag({ name: "a" });
				await adapter.createTag({ name: "b" });
				await adapter.createTag({ name: "c" });
				const tags = await adapter.listTags();
				expect(tags).toHaveLength(3);
				expect(tags.map((t) => t.name).sort()).toEqual(["a", "b", "c"]);
			});
		});

		suite("updateTag", () => {
			test("updates tag attributes", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "old" });
				const updated = await adapter.updateTag(tag.id, { name: "new" });
				expect(updated.name).toBe("new");
				expect(updated.id).toBe(tag.id);
			});

			test("persists the update", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "before" });
				await adapter.updateTag(tag.id, { name: "after" });
				const fetched = await adapter.getTag(tag.id);
				expect(fetched!.name).toBe("after");
			});

			test("throws TagNotFoundError for non-existent id", async () => {
				const adapter = await createAdapter();
				await expect(adapter.updateTag(crypto.randomUUID(), { name: "x" })).rejects.toBeInstanceOf(
					TagNotFoundError,
				);
			});
		});

		suite("deleteTag", () => {
			test("returns true when tag existed and removes it", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "bye" });
				const result = await adapter.deleteTag(tag.id);
				expect(result).toBe(true);
				expect(await adapter.getTag(tag.id)).toBeNull();
			});

			test("returns false for non-existent id", async () => {
				const adapter = await createAdapter();
				expect(await adapter.deleteTag(crypto.randomUUID())).toBe(false);
			});

			test("cleans up relations on delete", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "gone" });
				const key = objectKey("file1");
				await adapter.addRelations(tag.id, [key]);
				await adapter.deleteTag(tag.id);
				expect(await adapter.listObjectTags(key)).toHaveLength(0);
			});
		});

		suite("addRelations", () => {
			test("links a tag to multiple objects", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "photo" });
				const keys = [objectKey("img-1"), objectKey("img-2"), objectKey("img-3")];
				await adapter.addRelations(tag.id, keys);
				const objects = await adapter.listTagObjects(tag.id);
				expect(objects.sort()).toEqual(keys.sort());
			});

			test("ignores duplicate relations", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "dup" });
				const key = objectKey("doc-1");
				await adapter.addRelations(tag.id, [key]);
				await adapter.addRelations(tag.id, [key]);
				expect(await adapter.listTagObjects(tag.id)).toHaveLength(1);
			});

			test("does nothing for empty objectKeys array", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "empty" });
				await expect(adapter.addRelations(tag.id, [])).resolves.toBeUndefined();
			});
		});

		suite("removeRelations", () => {
			test("removes specified relations", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "multi" });
				const keys = [objectKey("a"), objectKey("b"), objectKey("c")];
				await adapter.addRelations(tag.id, keys);
				await adapter.removeRelations(tag.id, [objectKey("a"), objectKey("c")]);
				const objects = await adapter.listTagObjects(tag.id);
				expect(objects).toEqual([objectKey("b")]);
			});

			test("does nothing for empty objectKeys array", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "noop" });
				await adapter.addRelations(tag.id, [objectKey("x")]);
				await adapter.removeRelations(tag.id, []);
				expect(await adapter.listTagObjects(tag.id)).toHaveLength(1);
			});
		});

		suite("listObjectTags", () => {
			test("returns tag ids for a tagged object", async () => {
				const adapter = await createAdapter();
				const tag1 = await adapter.createTag({ name: "t1" });
				const tag2 = await adapter.createTag({ name: "t2" });
				const key = objectKey("shared-file");
				await adapter.addRelations(tag1.id, [key]);
				await adapter.addRelations(tag2.id, [key]);
				const result = await adapter.listObjectTags(key);
				expect(result).toHaveLength(2);
				expect(result).toContain(tag1.id);
				expect(result).toContain(tag2.id);
			});

			test("returns empty array for untagged object", async () => {
				const adapter = await createAdapter();
				expect(await adapter.listObjectTags(objectKey("untagged"))).toEqual([]);
			});
		});

		suite("listTagObjects", () => {
			test("returns object keys for a tag", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "docs" });
				const keys = [objectKey("doc-a"), objectKey("doc-b")];
				await adapter.addRelations(tag.id, keys);
				const result = await adapter.listTagObjects(tag.id);
				expect(result.sort()).toEqual(keys.sort());
			});

			test("returns empty array for tag with no objects", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "empty-tag" });
				expect(await adapter.listTagObjects(tag.id)).toEqual([]);
			});
		});

		suite("getAuxStore", () => {
			test("returns the same store instance for the same symbol", async () => {
				const adapter = await createAdapter();
				const sym = Symbol("ext");
				expect(adapter.getAuxStore(sym)).toBe(adapter.getAuxStore(sym));
			});

			test("find returns null for missing key", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-find"));
				const tag = await adapter.createTag({ name: "x" });
				expect(await store.find(tag.id)).toBeNull();
			});

			test("put stores and find retrieves data", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-put"));
				const tag = await adapter.createTag({ name: "x" });
				await store.put(tag.id, { count: 42 });
				expect(await store.find(tag.id)).toEqual({ count: 42 });
			});

			test("put overwrites existing data", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ count: number }>(Symbol("ext-overwrite"));
				const tag = await adapter.createTag({ name: "x" });
				await store.put(tag.id, { count: 1 });
				await store.put(tag.id, { count: 99 });
				expect(await store.find(tag.id)).toEqual({ count: 99 });
			});

			test("patch merges with existing data", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ a: number; b: string }>(Symbol("ext-patch"));
				const tag = await adapter.createTag({ name: "x" });
				await store.put(tag.id, { a: 1, b: "hello" });
				const result = await store.patch(tag.id, { a: 2 });
				expect(result).toEqual({ a: 2, b: "hello" });
				expect(await store.find(tag.id)).toEqual({ a: 2, b: "hello" });
			});

			test("patch returns null for missing key", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ x: number }>(Symbol("ext-patch-null"));
				const tag = await adapter.createTag({ name: "x" });
				expect(await store.patch(tag.id, { x: 5 })).toBeNull();
			});

			test("delete removes data and returns true", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ v: number }>(Symbol("ext-delete"));
				const tag = await adapter.createTag({ name: "x" });
				await store.put(tag.id, { v: 7 });
				expect(await store.delete(tag.id)).toBe(true);
				expect(await store.find(tag.id)).toBeNull();
			});

			test("delete returns false for missing key", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ v: number }>(Symbol("ext-delete-false"));
				const tag = await adapter.createTag({ name: "x" });
				expect(await store.delete(tag.id)).toBe(false);
			});

			test("list returns all entries for the extension", async () => {
				const adapter = await createAdapter();
				const store = adapter.getAuxStore<{ rank: number }>(Symbol("ext-list"));
				const tag1 = await adapter.createTag({ name: "t1" });
				const tag2 = await adapter.createTag({ name: "t2" });
				await store.put(tag1.id, { rank: 1 });
				await store.put(tag2.id, { rank: 2 });
				const result = await store.list();
				expect(result).toHaveLength(2);
				expect(result.map(([, d]) => d.rank).sort((a, b) => a - b)).toEqual([1, 2]);
			});

			test("isolates data between different extension symbols", async () => {
				const adapter = await createAdapter();
				const storeA = adapter.getAuxStore<{ val: string }>(Symbol("ext-iso-a"));
				const storeB = adapter.getAuxStore<{ val: string }>(Symbol("ext-iso-b"));
				const tag = await adapter.createTag({ name: "shared" });
				await storeA.put(tag.id, { val: "from-a" });
				expect(await storeB.find(tag.id)).toBeNull();
				expect(await storeA.find(tag.id)).toEqual({ val: "from-a" });
			});
		});

		suite("findObjects / countObjects", () => {
			test("findObjects returns lexicographically sorted matching keys", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "work" });
				await adapter.addRelations(tag.id, [objectKey("c"), objectKey("a"), objectKey("b")]);
				const result = await adapter.findObjects(taggedWithAny(tagsById([tag.id])));
				expect(result).toEqual([objectKey("a"), objectKey("b"), objectKey("c")]);
			});

			test("findObjects with taggedWithAll intersects matching tags", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "work" });
				const t2 = await adapter.createTag({ name: "urgent" });
				await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
				await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);
				const result = await adapter.findObjects(taggedWithAll(tagsById([t1.id, t2.id])));
				expect(result).toEqual([objectKey("b")]);
			});

			test("countObjects returns total matching count", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "work" });
				await adapter.addRelations(tag.id, [objectKey("a"), objectKey("b")]);
				expect(await adapter.countObjects(taggedWithAny(tagsById([tag.id])))).toBe(2);
			});

			test("findObjects with tagsWhere propertyEqual string predicate", async () => {
				const adapter = await createAdapter();
				const work = await adapter.createTag({ name: "work" });
				const home = await adapter.createTag({ name: "home" });
				await adapter.addRelations(work.id, [objectKey("a"), objectKey("b")]);
				await adapter.addRelations(home.id, [objectKey("c")]);
				const result = await adapter.findObjects(
					taggedWithAny(tagsWhere(propertyEqual("name", "work"))),
				);
				expect(result).toEqual([objectKey("a"), objectKey("b")]);
			});

			test("findObjects with tagsWhere propertyStartsWith predicate", async () => {
				const adapter = await createAdapter();
				const work = await adapter.createTag({ name: "work" });
				const workUrgent = await adapter.createTag({ name: "work-urgent" });
				const home = await adapter.createTag({ name: "home" });
				await adapter.addRelations(work.id, [objectKey("a")]);
				await adapter.addRelations(workUrgent.id, [objectKey("b")]);
				await adapter.addRelations(home.id, [objectKey("c")]);
				const result = await adapter.findObjects(
					taggedWithAny(tagsWhere(propertyStartsWith("name", "work"))),
				);
				expect(result).toEqual([objectKey("a"), objectKey("b")]);
			});

			test("findObjects with and query", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "t1" });
				const t2 = await adapter.createTag({ name: "t2" });
				await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
				await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);
				const result = await adapter.findObjects(
					and([taggedWithAny(tagsById([t1.id])), taggedWithAny(tagsById([t2.id]))]),
				);
				expect(result).toEqual([objectKey("b")]);
			});

			test("findObjects with or query", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "t1" });
				const t2 = await adapter.createTag({ name: "t2" });
				await adapter.addRelations(t1.id, [objectKey("a")]);
				await adapter.addRelations(t2.id, [objectKey("c")]);
				const result = await adapter.findObjects(
					or([taggedWithAny(tagsById([t1.id])), taggedWithAny(tagsById([t2.id]))]),
				);
				expect(result).toEqual([objectKey("a"), objectKey("c")]);
			});

			test("findObjects with not query excludes matched objects", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "t1" });
				const t2 = await adapter.createTag({ name: "t2" });
				await adapter.addRelations(t1.id, [objectKey("a"), objectKey("b")]);
				await adapter.addRelations(t2.id, [objectKey("b"), objectKey("c")]);
				const result = await adapter.findObjects(not(taggedWithAny(tagsById([t2.id]))));
				expect(result).toEqual([objectKey("a")]);
			});

			test("findObjects with intersectTags selector", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "work" });
				const t2 = await adapter.createTag({ name: "urgent" });
				const t3 = await adapter.createTag({ name: "home" });
				await adapter.addRelations(t1.id, [objectKey("a")]);
				await adapter.addRelations(t2.id, [objectKey("a")]);
				await adapter.addRelations(t3.id, [objectKey("b")]);
				const result = await adapter.findObjects(
					taggedWithAny(intersectTags([tagsById([t1.id, t2.id]), tagsById([t1.id, t3.id])])),
				);
				expect(result).toEqual([objectKey("a")]);
			});

			test("findObjects with unionTags selector", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "t1" });
				const t2 = await adapter.createTag({ name: "t2" });
				await adapter.addRelations(t1.id, [objectKey("a")]);
				await adapter.addRelations(t2.id, [objectKey("b")]);
				const result = await adapter.findObjects(
					taggedWithAny(unionTags([tagsById([t1.id]), tagsById([t2.id])])),
				);
				expect(result).toEqual([objectKey("a"), objectKey("b")]);
			});

			test("findObjects with complementTags selector", async () => {
				const adapter = await createAdapter();
				const t1 = await adapter.createTag({ name: "t1" });
				const t2 = await adapter.createTag({ name: "t2" });
				await adapter.addRelations(t1.id, [objectKey("a")]);
				await adapter.addRelations(t2.id, [objectKey("b")]);
				const result = await adapter.findObjects(taggedWithAny(complementTags(tagsById([t1.id]))));
				expect(result).toEqual([objectKey("b")]);
			});

			test("findObjects applies limit and offset", async () => {
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "page" });
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
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "x" });
				await adapter.addRelations(tag.id, [objectKey("a")]);
				expect(await adapter.findObjects(taggedWithAny(tagsById([])))).toEqual([]);
			});

			test("countObjects returns 0 for empty result", async () => {
				const adapter = await createAdapter();
				expect(await adapter.countObjects(taggedWithAny(tagsById([])))).toBe(0);
			});
		});

		suite("integration", () => {
			test("bidirectional relation lookup", async () => {
				const adapter = await createAdapter();
				const tag1 = await adapter.createTag({ name: "work" });
				const tag2 = await adapter.createTag({ name: "urgent" });
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
				const adapter = await createAdapter();
				const tag = await adapter.createTag({ name: "cleanup" });
				const keys = [objectKey("f1"), objectKey("f2"), objectKey("f3")];
				await adapter.addRelations(tag.id, keys);
				await adapter.removeRelations(tag.id, [objectKey("f2")]);
				const result = await adapter.listTagObjects(tag.id);
				expect(result.sort()).toEqual([objectKey("f1"), objectKey("f3")].sort());
			});
		});
	});
};
