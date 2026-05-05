import type { ApiShape, Extension, Tag } from "./index.ts";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import {
	and,
	not,
	objectKey,
	setupTagikon,
	taggedWithAll,
	taggedWithAny,
	TagikonError,
	tagsById,
	use,
} from "./index.ts";

interface TagWithName extends Tag<Uuid> {
	readonly name: string;
}

suite("Public API", () => {
	suite("core workflow", () => {
		test("creates and lists tags", async () => {
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER),
			});

			const work = await tagikon.addTag({ name: "work" });
			const personal = await tagikon.addTag({ name: "personal" });

			expect(work.name).toBe("work");
			expect(personal.name).toBe("personal");

			expect(await tagikon.listTags()).toHaveLength(2);
		});

		test("returns false on delete of nonexistent tag", async () => {
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER),
			});

			const tag = await tagikon.addTag({ name: "tmp" });

			// Delete existing tag
			const isDeleted = await tagikon.deleteTag(tag.id);
			expect(isDeleted).toBe(true);

			// Deleting again should return false, since the tag is already gone
			const isDeletedAgain = await tagikon.deleteTag(tag.id);
			expect(isDeletedAgain).toBe(false);
		});

		test("library errors are instanceof TagikonError", async () => {
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
			});

			const tag = await tagikon.addTag({});
			await tagikon.deleteTag(tag.id);

			await expect(tagikon.editTag(tag.id, { name: "y" })).rejects.toBeInstanceOf(TagikonError);
		});
	});

	suite("findObjects / countObjects via storage", () => {
		/**
		 * - doc1: work, urgent
		 * - doc2: work + personal
		 * - doc3: personal
		 */
		const setupFindScenario = async () => {
			const storage = new MapStorageAdapter<TagWithName>(UUID_ID_PROVIDER);
			const tagikon = setupTagikon({ storageAdapter: storage });

			const work = await tagikon.addTag({ name: "work" });
			const personal = await tagikon.addTag({ name: "personal" });
			const urgent = await tagikon.addTag({ name: "urgent" });

			await tagikon.tagObjects(work.id, [objectKey("doc1"), objectKey("doc2")]);
			await tagikon.tagObjects(personal.id, [objectKey("doc2"), objectKey("doc3")]);
			await tagikon.tagObjects(urgent.id, [objectKey("doc1")]);

			return { tagikon, work, personal, urgent };
		};

		test("taggedWithAny: returns objects with the given tag", async () => {
			const { tagikon, work } = await setupFindScenario();
			const result = await tagikon.findObjects(taggedWithAny(tagsById([work.id])));
			expect(result).toHaveLength(2);
			expect(result).toContain(objectKey("doc1"));
			expect(result).toContain(objectKey("doc2"));
		});

		test("taggedWithAll: intersection across multiple tags", async () => {
			const { tagikon, work, urgent } = await setupFindScenario();

			const result = await tagikon.findObjects(taggedWithAll(tagsById([work.id, urgent.id])));

			expect(result).toHaveLength(1);
			expect(result).toContain(objectKey("doc1"));
		});

		test("and: intersection across multiple queries", async () => {
			const { tagikon, work, urgent } = await setupFindScenario();
			const result = await tagikon.findObjects(
				and([taggedWithAny(tagsById([work.id])), taggedWithAny(tagsById([urgent.id]))]),
			);
			expect(result).toHaveLength(1);
			expect(result).toContain(objectKey("doc1"));
		});

		test("not: excludes matched objects", async () => {
			const { tagikon, work } = await setupFindScenario();
			const result = await tagikon.findObjects(not(taggedWithAny(tagsById([work.id]))));
			expect(result).toHaveLength(1);
			expect(result).toContain(objectKey("doc3"));
		});

		test("countObjects: returns count of matching objects", async () => {
			const { tagikon, work } = await setupFindScenario();
			const result = await tagikon.countObjects(taggedWithAny(tagsById([work.id])));
			expect(result).toBe(2);
		});
	});

	suite("TagImplement extension", () => {
		interface TagWithNote extends Tag<Uuid> {
			readonly note: string;
		}

		test("extended tag fields are preserved through addTag", async () => {
			const storage = new MapStorageAdapter<TagWithNote>(UUID_ID_PROVIDER);
			const tagikon = setupTagikon({
				storageAdapter: storage,
				extensions: [
					use<TagWithNote>({
						hooks: {
							addTag: {
								transform(_ctx, input) {
									return { ...input, note: input.note ?? "" };
								},
							},
						},
					}),
				],
			});
			const tag = await tagikon.addTag({ note: "important" });
			expect(tag.note).toBe("important");
		});
	});

	suite("Custom API extension", () => {
		const STATS_NS = Symbol("stats");

		test("exposes custom API on the server within namespace", async () => {
			interface StatsAPI extends ApiShape {
				tagCount: () => Promise<number>;
			}
			const extension: Extension<Tag, typeof STATS_NS, StatsAPI> = {
				namespace: STATS_NS,
				// Specify permissions the extension requires to function.
				// The server will check these against what is granted when registering the extension, and throw if they are not satisfied.
				permissions: { permissions: ["tag:read"] },
				api: {
					async tagCount(ctx) {
						return (await ctx.storage.listTags()).length;
					},
				},
			};
			const storage = new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER);
			const tagikon = setupTagikon({
				storageAdapter: storage,
				extensions: [
					use(extension, {
						permissions: ["tag:read"],
					}),
				],
			});
			await tagikon.addTag({});
			await tagikon.addTag({});
			expect(await tagikon[STATS_NS].tagCount()).toBe(2);
		});
	});
});
