import type { TagWithSoftDelete } from "./soft-delete.ts";

import { expect, suite, test } from "vitest";

import { createServer } from "../api/server.ts";
import { objectKey } from "../core/ids.ts";
import { not, tagProperty } from "../finder/condition.ts";
import { MemoryFinder } from "../finder/memory-finder.ts";
import { MemoryStorageAdapter } from "../storage/memory.ts";
import { SOFT_DELETE_NS, createSoftDelete } from "./soft-delete.ts";
import { use } from "./use.ts";

const setup = () => {
	const storage = new MemoryStorageAdapter<TagWithSoftDelete>();
	const plugin = createSoftDelete<TagWithSoftDelete>();
	const server = createServer({
		storage,
		plugins: [use(plugin, { permissions: ["tag:read", "tag:write"] })],
	});
	return { storage, server };
};

suite("createSoftDelete", () => {
	suite("addTag", () => {
		test("creates a tag with isDeleted=false by default", async () => {
			const { server } = setup();
			const tag = await server.addTag("work");
			expect(tag.isDeleted).toBe(false);
		});
	});

	suite("softDeleteTag", () => {
		test("marks tag as deleted in storage without removing it", async () => {
			const { storage, server } = setup();
			const tag = await server.addTag("tmp");
			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);

			expect(result).toBe(true);
			const raw = await storage.getTag(tag.id);
			expect(raw!.isDeleted).toBe(true);
		});

		test("returns false for an already soft-deleted tag", async () => {
			const { server } = setup();
			const tag = await server.addTag("tmp");
			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);

			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			expect(result).toBe(false);
		});

		test("returns false for a non-existent tag", async () => {
			const { server } = setup();
			const tag = await server.addTag("tmp");
			await server.deleteTag(tag.id);

			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			expect(result).toBe(false);
		});
	});

	suite("listTags", () => {
		test("excludes soft-deleted tags", async () => {
			const { server } = setup();
			await server.addTag("active");
			const gone = await server.addTag("gone");
			await server[SOFT_DELETE_NS].softDeleteTag(gone.id);

			const tags = await server.listTags();
			expect(tags).toHaveLength(1);
			expect(tags[0]!.name).toBe("active");
		});
	});

	suite("deleteTag", () => {
		test("hard-deletes: tag is removed from storage entirely", async () => {
			const { storage, server } = setup();
			const tag = await server.addTag("ghost");
			await server.deleteTag(tag.id);

			const raw = await storage.getTag(tag.id);
			expect(raw).toBeNull();
		});
	});

	suite("listSoftDeletedTags", () => {
		test("returns only soft-deleted tags", async () => {
			const { server } = setup();
			await server.addTag("active");
			const gone = await server.addTag("gone");
			await server[SOFT_DELETE_NS].softDeleteTag(gone.id);

			const result = await server[SOFT_DELETE_NS].listSoftDeletedTags();
			expect(result).toHaveLength(1);
			expect(result[0]!.name).toBe("gone");
		});
	});

	suite("restoreTag", () => {
		test("makes the tag visible again in listTags", async () => {
			const { server } = setup();
			const tag = await server.addTag("restore-me");
			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			await server[SOFT_DELETE_NS].restoreTag(tag.id);

			const tags = await server.listTags();
			expect(tags).toHaveLength(1);
			expect(tags[0]!.isDeleted).toBe(false);
		});

		test("relations survive soft-delete and remain after restore", async () => {
			const { server } = setup();
			const tag = await server.addTag("label");
			await server.tagObjects(tag.id, [objectKey("file1"), objectKey("file2")]);

			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			await server[SOFT_DELETE_NS].restoreTag(tag.id);

			const tags = await server.listTags();
			expect(tags[0]!.name).toBe("label");
		});
	});
});

suite("TagPropertyCondition with MemoryFinder", () => {
	test("tag-property: finds objects tagged with tags matching the property value", async () => {
		const storage = new MemoryStorageAdapter<TagWithSoftDelete>();
		const finder = new MemoryFinder<TagWithSoftDelete>();

		const active = await storage.createTag({ name: "active", isDeleted: false });
		const deleted = await storage.createTag({ name: "deleted", isDeleted: true });

		await storage.addRelations(active.id, [objectKey("obj1")]);
		await storage.addRelations(deleted.id, [objectKey("obj2")]);
		await storage.addRelations(active.id, [objectKey("obj3")]);

		const result = await finder.findObjectsByTags(tagProperty("isDeleted", false), storage);
		expect(new Set(result as string[])).toEqual(new Set(["obj1", "obj3"]));
	});

	test("not(tag-property): excludes objects tagged with matching tags", async () => {
		const storage = new MemoryStorageAdapter<TagWithSoftDelete>();
		const finder = new MemoryFinder<TagWithSoftDelete>();

		const active = await storage.createTag({ name: "active", isDeleted: false });
		const deleted = await storage.createTag({ name: "deleted", isDeleted: true });

		await storage.addRelations(active.id, [objectKey("obj1")]);
		await storage.addRelations(deleted.id, [objectKey("obj2")]);

		const result = await finder.findObjectsByTags(not(tagProperty("isDeleted", true)), storage);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(objectKey("obj1"));
	});
});
