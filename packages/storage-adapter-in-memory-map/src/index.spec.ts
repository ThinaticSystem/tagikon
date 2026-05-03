import type { IdProvider, Tag } from "@tagikon/core";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { objectKey, TagNotFoundError } from "@tagikon/core";
import { uuid, UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { expect, suite, test } from "vitest";

import { MapStorageAdapter } from "./index.ts";

interface TagWithName extends Tag<Uuid> {
	readonly name: string;
}

suite("MapStorageAdapter", () => {
	suite("createTag", () => {
		test("creates a tag and assigns an id", async () => {
			const adapter = new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({ name: "work" });
			expect(tag.name).toBe("work");
			expect(typeof tag.id).toBe("string");
		});
	});

	suite("getTag", () => {
		test("returns the tag by id", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const created = await adapter.createTag({});
			const found = await adapter.getTag(created.id);
			expect(found).toEqual(created);
		});

		test("returns null for unknown id", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const result = await adapter.getTag(uuid("nonexistent"));
			expect(result).toBeNull();
		});
	});

	suite("listTags", () => {
		test("returns all created tags", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			await adapter.createTag({});
			await adapter.createTag({});
			const all = await adapter.listTags();
			expect(all).toHaveLength(2);
		});
	});

	suite("updateTag", () => {
		test("updates tag fields", async () => {
			const adapter = new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({ name: "old" });
			const updated = await adapter.updateTag(tag.id, { name: "new" });
			expect(updated.name).toBe("new");
		});

		test("throws TagNotFoundError for unknown id", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			await expect(adapter.updateTag(uuid("ghost"), {})).rejects.toBeInstanceOf(TagNotFoundError);
		});
	});

	suite("deleteTag", () => {
		test("returns true when tag existed", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({});
			expect(await adapter.deleteTag(tag.id)).toBe(true);
		});

		test("returns false when tag did not exist", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			expect(await adapter.deleteTag(uuid("ghost"))).toBe(false);
		});

		test("cleans up relations on delete", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({});
			await adapter.addRelations(tag.id, [objectKey("file1")]);
			await adapter.deleteTag(tag.id);
			const tags = await adapter.listObjectTags(objectKey("file1"));
			expect(tags).toHaveLength(0);
		});
	});

	suite("relations", () => {
		test("addRelations / listTagObjects / listObjectTags", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({});
			await adapter.addRelations(tag.id, [objectKey("img1"), objectKey("img2")]);

			expect(await adapter.listTagObjects(tag.id)).toEqual(
				expect.arrayContaining([objectKey("img1"), objectKey("img2")]),
			);
			expect(await adapter.listObjectTags(objectKey("img1"))).toEqual([tag.id]);
		});

		test("removeRelations removes only specified keys", async () => {
			const adapter = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const tag = await adapter.createTag({});
			await adapter.addRelations(tag.id, [objectKey("a"), objectKey("b"), objectKey("c")]);
			await adapter.removeRelations(tag.id, [objectKey("b")]);
			const objects = await adapter.listTagObjects(tag.id);
			expect(objects).not.toContain(objectKey("b"));
			expect(objects).toContain(objectKey("a"));
		});
	});

	suite("custom ID plugin", () => {
		test("uses the provided generator for new tag ids", async () => {
			let counter = 0;
			const numericPlugin: IdProvider<number> = {
				generate: () => ++counter,
				serialize: (id) => String(id),
				deserialize: (raw) => Number(raw),
			};
			const adapter = new MapStorageAdapter<Tag<number>>(numericPlugin);
			const tag = await adapter.createTag({});
			expect(tag.id).toBe(1);
			expect(typeof tag.id).toBe("number");
		});

		test("serialize/deserialize roundtrip for listObjectTags", async () => {
			let counter = 0;
			const numericPlugin: IdProvider<number> = {
				generate: () => ++counter,
				serialize: (id) => String(id),
				deserialize: (raw) => Number(raw),
			};
			const adapter = new MapStorageAdapter<Tag<number>>(numericPlugin);
			const tag = await adapter.createTag({});
			await adapter.addRelations(tag.id, [objectKey("obj1")]);
			const tagIds = await adapter.listObjectTags(objectKey("obj1"));
			expect(tagIds).toEqual([tag.id]);
			expect(typeof tagIds[0]).toBe("number");
		});
	});
});
