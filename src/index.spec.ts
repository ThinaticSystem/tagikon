import type { ApiShape, Tag, TaginkonPlugin } from "./index.ts";

import { expect, suite, test } from "vitest";

import {
	MemoryFinder,
	MemoryStorageAdapter,
	TagAlreadyExistsError,
	TaginkonError,
	and,
	createServer,
	has,
	not,
	objectKey,
	use,
} from "./index.ts";

suite("Public API", () => {
	suite("core workflow", () => {
		test("creates and lists tags", async () => {
			const server = createServer({ storage: new MemoryStorageAdapter() });

			const work = await server.addTag("work");
			const personal = await server.addTag("personal");

			expect(work.name).toBe("work");
			expect(personal.name).toBe("personal");

			expect(await server.listTags()).toHaveLength(2);
		});

		test("TagAlreadyExistsError on duplicate name", async () => {
			const server = createServer({ storage: new MemoryStorageAdapter() });

			await server.addTag("dup");
			await expect(server.addTag("dup")).rejects.toBeInstanceOf(TagAlreadyExistsError);
		});

		test("returns false on delete of nonexistent tag", async () => {
			const server = createServer({ storage: new MemoryStorageAdapter() });

			const tag = await server.addTag("tmp");

			// Delete existing tag
			const isDeleted = await server.deleteTag(tag.id);
			expect(isDeleted).toBe(true);

			// Deleting again should return false, since the tag is already gone
			const isDeletedAgain = await server.deleteTag(tag.id);
			expect(isDeletedAgain).toBe(false);
		});

		test("library errors are instanceof TaginkonError", async () => {
			const server = createServer({ storage: new MemoryStorageAdapter() });

			await server.addTag("x");
			await expect(server.addTag("x")).rejects.toBeInstanceOf(TaginkonError);
		});
	});

	suite("find with MemoryFinder", () => {
		/**
		 * - doc1: work, urgent
		 * - doc2: work + personal
		 * - doc3: personal
		 */
		const setupFindScenario = async () => {
			const storage = new MemoryStorageAdapter();
			const plugin: TaginkonPlugin<Tag> = {
				finder: new MemoryFinder(),
			};
			const server = createServer({
				storage,
				plugins: [use(plugin)],
			});

			const work = await server.addTag("work");
			const personal = await server.addTag("personal");
			const urgent = await server.addTag("urgent");

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

	suite("TagImplement plugin", () => {
		interface TagWithNote extends Tag {
			readonly note: string;
		}

		test("extended tag fields are preserved through addTag", async () => {
			const storage = new MemoryStorageAdapter<TagWithNote>();
			const server = createServer({
				storage,
				plugins: [
					use<TagWithNote>({
						addTag: {
							transform(input) {
								return { ...input, note: input.note ?? "" };
							},
						},
					}),
				],
			});
			const tag = await server.addTag("meeting", { note: "important" });
			expect(tag.note).toBe("important");
		});
	});

	suite("Custom API plugin", () => {
		const STATS_NS: unique symbol = Symbol("stats");

		test("exposes custom API on the server within namespace", async () => {
			interface StatsAPI extends ApiShape {
				tagCount: () => Promise<number>;
			}
			const plugin: TaginkonPlugin<Tag, typeof STATS_NS, StatsAPI> = {
				namespace: STATS_NS,
				// Specify permissions the plugin requires to function.
				// The server will check these against what is granted when registering the plugin, and throw if they are not satisfied.
				permissions: { permissions: ["tag:read"] },
				api: {
					async tagCount(ctx) {
						return (await ctx.storage.listTags()).length;
					},
				},
			};
			const storage = new MemoryStorageAdapter();
			const server = createServer({
				storage,
				plugins: [
					use(plugin, {
						permissions: ["tag:read"],
					}),
				],
			});
			await server.addTag("a");
			await server.addTag("b");
			expect(await server[STATS_NS].tagCount()).toBe(2);
		});
	});
});
