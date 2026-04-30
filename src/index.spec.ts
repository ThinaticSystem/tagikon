import type { ApiShape, Extension, Tag } from "./index.ts";

import { expect, suite, test } from "vitest";

import {
	and,
	createServer,
	has,
	MapStorageAdapter,
	MemoryFinder,
	not,
	objectKey,
	TagikonError,
	use,
} from "./index.ts";

interface TagWithName extends Tag {
	readonly name: string;
}

suite("Public API", () => {
	suite("core workflow", () => {
		test("creates and lists tags", async () => {
			const server = createServer({ storage: new MapStorageAdapter<TagWithName>() });

			const work = await server.addTag({ name: "work" });
			const personal = await server.addTag({ name: "personal" });

			expect(work.name).toBe("work");
			expect(personal.name).toBe("personal");

			expect(await server.listTags()).toHaveLength(2);
		});

		test("returns false on delete of nonexistent tag", async () => {
			const server = createServer({ storage: new MapStorageAdapter<TagWithName>() });

			const tag = await server.addTag({ name: "tmp" });

			// Delete existing tag
			const isDeleted = await server.deleteTag(tag.id);
			expect(isDeleted).toBe(true);

			// Deleting again should return false, since the tag is already gone
			const isDeletedAgain = await server.deleteTag(tag.id);
			expect(isDeletedAgain).toBe(false);
		});

		test("library errors are instanceof TagikonError", async () => {
			const server = createServer({ storage: new MapStorageAdapter() });

			const tag = await server.addTag({});
			await server.deleteTag(tag.id);

			await expect(server.editTag(tag.id, { name: "y" })).rejects.toBeInstanceOf(TagikonError);
		});
	});

	suite("find with MemoryFinder", () => {
		/**
		 * - doc1: work, urgent
		 * - doc2: work + personal
		 * - doc3: personal
		 */
		const setupFindScenario = async () => {
			const storage = new MapStorageAdapter<TagWithName>();
			const extension: Extension<TagWithName> = {
				finder: new MemoryFinder(),
			};
			const server = createServer({
				storage,
				extensions: [use(extension)],
			});

			const work = await server.addTag({ name: "work" });
			const personal = await server.addTag({ name: "personal" });
			const urgent = await server.addTag({ name: "urgent" });

			await server.tagObjects(work.id, [objectKey("doc1"), objectKey("doc2")]);
			await server.tagObjects(personal.id, [objectKey("doc2"), objectKey("doc3")]);
			await server.tagObjects(urgent.id, [objectKey("doc1")]);

			return { server, work, personal, urgent };
		};

		test("has: returns objects with the given tag", async () => {
			const { server, work } = await setupFindScenario();
			const result = await server.findObjectsByTags(has(work.id));
			expect(result).toHaveLength(2);
			expect(result).toContain(objectKey("doc1"));
			expect(result).toContain(objectKey("doc2"));
		});

		test("and: intersection of tag-matched objects", async () => {
			const { server, work, urgent } = await setupFindScenario();
			const result = await server.findObjectsByTags(and([has(work.id), has(urgent.id)]));
			expect(result).toHaveLength(1);
			expect(result).toContain(objectKey("doc1"));
		});

		test("not: excludes matched objects", async () => {
			const { server, work } = await setupFindScenario();
			const result = await server.findObjectsByTags(not(has(work.id)));
			expect(result).toHaveLength(1);
			expect(result).toContain(objectKey("doc3"));
		});
	});

	suite("TagImplement extension", () => {
		interface TagWithNote extends Tag {
			readonly note: string;
		}

		test("extended tag fields are preserved through addTag", async () => {
			const storage = new MapStorageAdapter<TagWithNote>();
			const server = createServer({
				storage,
				extensions: [
					use<TagWithNote>({
						hooks: {
							addTag: {
								transform(input) {
									return { ...input, note: input.note ?? "" };
								},
							},
						},
					}),
				],
			});
			const tag = await server.addTag({ note: "important" });
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
			const storage = new MapStorageAdapter();
			const server = createServer({
				storage,
				extensions: [
					use(extension, {
						permissions: ["tag:read"],
					}),
				],
			});
			await server.addTag({});
			await server.addTag({});
			expect(await server[STATS_NS].tagCount()).toBe(2);
		});
	});
});
