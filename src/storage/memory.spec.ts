import type { Tag } from "../core/tag.ts";
import type { TagIdPlugin } from "../plugin/tag-id-plugin.ts";

import { expect, suite, test } from "vitest";

import { TagAlreadyExistsError, TagNotFoundError } from "../core/errors.ts";
import { objectKey, tagId } from "../core/ids.ts";
import { MemoryStorageAdapter } from "./memory.ts";

const ok = (s: string) => objectKey(s);

suite("MemoryStorageAdapter", () => {
	suite("createTag", () => {
		test("creates a tag and assigns an id", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "work" });
			expect(tag.name).toBe("work");
			expect(typeof tag.id).toBe("string");
		});

		test("throws TagAlreadyExistsError on duplicate name", async () => {
			const adapter = new MemoryStorageAdapter();
			await adapter.createTag({ name: "work" });
			await expect(adapter.createTag({ name: "work" })).rejects.toBeInstanceOf(
				TagAlreadyExistsError,
			);
		});
	});

	suite("getTag", () => {
		test("returns the tag by id", async () => {
			const adapter = new MemoryStorageAdapter();
			const created = await adapter.createTag({ name: "home" });
			const found = await adapter.getTag(created.id);
			expect(found).toEqual(created);
		});

		test("returns null for unknown id", async () => {
			const adapter = new MemoryStorageAdapter();
			const result = await adapter.getTag(tagId("nonexistent"));
			expect(result).toBeNull();
		});
	});

	suite("listTags", () => {
		test("returns all created tags", async () => {
			const adapter = new MemoryStorageAdapter();
			await adapter.createTag({ name: "a" });
			await adapter.createTag({ name: "b" });
			const all = await adapter.listTags();
			expect(all).toHaveLength(2);
		});
	});

	suite("updateTag", () => {
		test("updates tag fields", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "old" });
			const updated = await adapter.updateTag(tag.id, { name: "new" });
			expect(updated.name).toBe("new");
		});

		test("throws TagNotFoundError for unknown id", async () => {
			const adapter = new MemoryStorageAdapter();
			await expect(adapter.updateTag(tagId("ghost"), { name: "x" })).rejects.toBeInstanceOf(
				TagNotFoundError,
			);
		});
	});

	suite("deleteTag", () => {
		test("returns true when tag existed", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "tmp" });
			expect(await adapter.deleteTag(tag.id)).toBe(true);
		});

		test("returns false when tag did not exist", async () => {
			const adapter = new MemoryStorageAdapter();
			expect(await adapter.deleteTag(tagId("ghost"))).toBe(false);
		});

		test("cleans up relations on delete", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "x" });
			await adapter.addRelations(tag.id, [ok("file1")]);
			await adapter.deleteTag(tag.id);
			const tags = await adapter.listObjectTags(ok("file1"));
			expect(tags).toHaveLength(0);
		});
	});

	suite("relations", () => {
		test("addRelations / listTagObjects / listObjectTags", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "photos" });
			await adapter.addRelations(tag.id, [ok("img1"), ok("img2")]);

			expect(await adapter.listTagObjects(tag.id)).toEqual(
				expect.arrayContaining([ok("img1"), ok("img2")]),
			);
			expect(await adapter.listObjectTags(ok("img1"))).toEqual([tag.id]);
		});

		test("removeRelations removes only specified keys", async () => {
			const adapter = new MemoryStorageAdapter();
			const tag = await adapter.createTag({ name: "docs" });
			await adapter.addRelations(tag.id, [ok("a"), ok("b"), ok("c")]);
			await adapter.removeRelations(tag.id, [ok("b")]);
			const objects = await adapter.listTagObjects(tag.id);
			expect(objects).not.toContain(ok("b"));
			expect(objects).toContain(ok("a"));
		});
	});

	suite("custom idPlugin", () => {
		test("uses the provided generator for new tag ids", async () => {
			let counter = 0;
			const numericPlugin: TagIdPlugin<number> = {
				generate: () => ++counter,
				serialize: (id) => String(id),
				deserialize: (raw) => Number(raw),
			};
			const adapter = new MemoryStorageAdapter<Tag<number>>({
				idPlugin: numericPlugin,
			});
			const tag = await adapter.createTag({ name: "counted" });
			expect(tag.id).toBe(1);
			expect(typeof tag.id).toBe("number");
		});

		test("serialize/deserialize roundtrip for listObjectTags", async () => {
			let counter = 0;
			const numericPlugin: TagIdPlugin<number> = {
				generate: () => ++counter,
				serialize: (id) => String(id),
				deserialize: (raw) => Number(raw),
			};
			const adapter = new MemoryStorageAdapter<Tag<number>>({
				idPlugin: numericPlugin,
			});
			const tag = await adapter.createTag({ name: "num" });
			await adapter.addRelations(tag.id, [ok("obj1")]);
			const tagIds = await adapter.listObjectTags(ok("obj1"));
			expect(tagIds).toEqual([tag.id]);
			expect(typeof tagIds[0]).toBe("number");
		});
	});
});
