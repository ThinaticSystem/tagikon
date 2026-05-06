import type { TagWithSoftDelete } from "./index.ts";
import type { Uuid } from "@tagikon/id-provider-uuid";

import {
	evaluateObjectQueryInMemory,
	not,
	objectKey,
	propertyEqual,
	setupTagikon,
	taggedWithAny,
	tagsWhere,
	tpc,
	use,
} from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import { SOFT_DELETE_NS, createSoftDelete } from "./index.ts";

const setup = () => {
	const storage = new MapStorageAdapter<TagWithSoftDelete<Uuid>>();
	const extension = createSoftDelete<TagWithSoftDelete<Uuid>>();
	const server = setupTagikon({
		tagShape: {
			id: UUID_ID_PROVIDER,
			isDeleted: tpc.boolean(),
		},
		storageAdapter: storage,
		extensions: [use(extension, { permissions: ["tag:read", "tag:write"] })],
	});
	return { storage, server };
};

suite("createSoftDelete", () => {
	suite("addTag", () => {
		test("transform enforces isDeleted=false regardless of input", async () => {
			const { server } = setup();
			const tag = await server.addTag({ isDeleted: true });
			expect(tag.isDeleted).toBe(false);
		});
	});

	suite("softDeleteTag", () => {
		test("marks tag as deleted in storage without removing it", async () => {
			const { storage, server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);

			expect(result).toBe(true);
			const raw = await storage.getTag(tag.id);
			expect(raw!.isDeleted).toBe(true);
		});

		test("returns false for an already soft-deleted tag", async () => {
			const { server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);

			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			expect(result).toBe(false);
		});

		test("returns false for a non-existent tag", async () => {
			const { server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			await server.deleteTag(tag.id);

			const result = await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			expect(result).toBe(false);
		});
	});

	suite("listTags", () => {
		test("excludes soft-deleted tags", async () => {
			const { server } = setup();
			const active = await server.addTag({ isDeleted: false });
			const gone = await server.addTag({ isDeleted: false });
			await server[SOFT_DELETE_NS].softDeleteTag(gone.id);

			const tags = await server.listTags();
			expect(tags).toHaveLength(1);
			expect(tags[0]!.id).toBe(active.id);
		});
	});

	suite("deleteTag", () => {
		test("hard-deletes: tag is removed from storage entirely", async () => {
			const { storage, server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			await server.deleteTag(tag.id);

			const raw = await storage.getTag(tag.id);
			expect(raw).toBeNull();
		});
	});

	suite("listSoftDeletedTags", () => {
		test("returns only soft-deleted tags", async () => {
			const { server } = setup();
			await server.addTag({ isDeleted: false });
			const gone = await server.addTag({ isDeleted: false });
			await server[SOFT_DELETE_NS].softDeleteTag(gone.id);

			const result = await server[SOFT_DELETE_NS].listSoftDeletedTags();
			expect(result).toHaveLength(1);
			expect(result[0]!.id).toBe(gone.id);
		});
	});

	suite("restoreTag", () => {
		test("makes the tag visible again in listTags", async () => {
			const { server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			await server[SOFT_DELETE_NS].restoreTag(tag.id);

			const tags = await server.listTags();
			expect(tags).toHaveLength(1);
			expect(tags[0]!.isDeleted).toBe(false);
		});

		test("relations survive soft-delete and remain after restore", async () => {
			const { server } = setup();
			const tag = await server.addTag({ isDeleted: false });
			await server.tagObjects(tag.id, [objectKey("file1"), objectKey("file2")]);

			await server[SOFT_DELETE_NS].softDeleteTag(tag.id);
			await server[SOFT_DELETE_NS].restoreTag(tag.id);

			const tags = await server.listTags();
			expect(tags[0]!.id).toBe(tag.id);
		});
	});
});

suite("tag property queries with evaluateObjectQueryInMemory", () => {
	test("tagsWhere: finds objects tagged with tags matching the property value", async () => {
		const storage = new MapStorageAdapter<TagWithSoftDelete<Uuid>>();
		storage.setIdProvider(UUID_ID_PROVIDER);

		const active = await storage.createTag({ isDeleted: false });
		const deleted = await storage.createTag({ isDeleted: true });

		await storage.addRelations(active.id, [objectKey("obj1")]);
		await storage.addRelations(deleted.id, [objectKey("obj2")]);
		await storage.addRelations(active.id, [objectKey("obj3")]);

		const result = await evaluateObjectQueryInMemory(
			taggedWithAny<Uuid>(tagsWhere(propertyEqual("isDeleted", false))),
			storage,
		);

		expect(new Set(result as string[])).toEqual(new Set(["obj1", "obj3"]));
	});

	test("not(tagsWhere): excludes objects tagged with matching tags", async () => {
		const storage = new MapStorageAdapter<TagWithSoftDelete<Uuid>>();
		storage.setIdProvider(UUID_ID_PROVIDER);

		const active = await storage.createTag({ isDeleted: false });
		const deleted = await storage.createTag({ isDeleted: true });

		await storage.addRelations(active.id, [objectKey("obj1")]);
		await storage.addRelations(deleted.id, [objectKey("obj2")]);

		const result = await evaluateObjectQueryInMemory(
			not(taggedWithAny<Uuid>(tagsWhere(propertyEqual("isDeleted", true)))),
			storage,
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(objectKey("obj1"));
	});
});
