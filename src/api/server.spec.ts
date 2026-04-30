import type { Tag } from "../core/tag.ts";
import type { TagikonPlugin } from "../plugin/types.ts";

import { expect, suite, test, vi } from "vitest";

import { TagNotFoundError } from "../core/errors.ts";
import { objectKey } from "../core/ids.ts";
import { use } from "../plugin/use.ts";
import { MemoryStorageAdapter } from "../storage/memory.ts";
import { createServer } from "./server.ts";

interface TagWithLabel extends Tag {
	readonly label: string;
}

const makeServer = () => {
	const storage = new MemoryStorageAdapter<TagWithLabel>();
	const server = createServer<TagWithLabel>({ storage });
	return { server, storage };
};

suite("Server", () => {
	suite("addTag", () => {
		test("creates a tag with the given attributes", async () => {
			const { server } = makeServer();
			const tag = await server.addTag({ label: "work" });
			expect(tag.label).toBe("work");
			expect(tag.id).toBeDefined();
		});
	});

	suite("listTags", () => {
		test("returns all tags", async () => {
			const { server } = makeServer();
			await server.addTag({ label: "a" });
			await server.addTag({ label: "b" });
			const tags = await server.listTags();
			expect(tags).toHaveLength(2);
		});
	});

	suite("editTag", () => {
		test("updates the tag attributes", async () => {
			const { server } = makeServer();
			const tag = await server.addTag({ label: "old" });
			const updated = await server.editTag(tag.id, { label: "new" });
			expect(updated.label).toBe("new");
		});

		test("throws TagNotFoundError for unknown id", async () => {
			const { server } = makeServer();
			const tag = await server.addTag({ label: "tmp" });
			await server.deleteTag(tag.id);

			await expect(server.editTag(tag.id, { label: "x" })).rejects.toBeInstanceOf(TagNotFoundError);
		});
	});

	suite("deleteTag", () => {
		test("deletes a tag", async () => {
			const { server } = makeServer();
			const tag = await server.addTag({ label: "bye" });
			const result = await server.deleteTag(tag.id);

			expect(result).toBe(true);
			expect(await server.listTags()).toHaveLength(0);
		});

		test("returns false for unknown id", async () => {
			const { server } = makeServer();
			const tag = await server.addTag({ label: "tmp" });
			const result1 = await server.deleteTag(tag.id);
			expect(result1).toBe(true);

			const result2 = await server.deleteTag(tag.id);
			expect(result2).toBe(false);
		});
	});

	suite("tagObjects / untagObjects", () => {
		test("tags and untags objects", async () => {
			const { server, storage } = makeServer();
			const tag = await server.addTag({ label: "photos" });
			await server.tagObjects(tag.id, [objectKey("img1"), objectKey("img2")]);
			expect(await storage.listTagObjects(tag.id)).toHaveLength(2);

			await server.untagObjects(tag.id, [objectKey("img1")]);
			expect(await storage.listTagObjects(tag.id)).toEqual([objectKey("img2")]);
		});
	});

	suite("resetWithTags", () => {
		test("replaces object tags with the given set", async () => {
			const { server, storage } = makeServer();
			const t1 = await server.addTag({ label: "t1" });
			const t2 = await server.addTag({ label: "t2" });
			const t3 = await server.addTag({ label: "t3" });

			await server.tagObjects(t1.id, [objectKey("file")]);
			await server.tagObjects(t2.id, [objectKey("file")]);
			// file has t1, t2 — reset to t2, t3
			await server.resetWithTags(objectKey("file"), [t2.id, t3.id]);

			const objectTags = await storage.listObjectTags(objectKey("file"));
			expect(objectTags).toHaveLength(2);
			expect(objectTags).toContain(t2.id);
			expect(objectTags).toContain(t3.id);
			expect(objectTags).not.toContain(t1.id);
		});
	});

	suite("hooks", () => {
		test("tapRaw is called before transform with the original input", async () => {
			const tapRaw = vi.fn();
			const storage = new MemoryStorageAdapter<TagWithLabel>();
			const server = createServer({
				storage,
				plugins: [use<TagWithLabel>({ hooks: { addTag: { tapRaw } } })],
			});
			await server.addTag({ label: "observe" });
			expect(tapRaw).toHaveBeenCalledWith(expect.objectContaining({ label: "observe" }));
		});

		test("transform can mutate the input before storage write", async () => {
			const storage = new MemoryStorageAdapter<TagWithLabel>();
			const server = createServer({
				storage,
				plugins: [
					use<TagWithLabel>({
						hooks: {
							addTag: {
								transform(input) {
									return { ...input, label: input.label.toUpperCase() };
								},
							},
						},
					}),
				],
			});
			const tag = await server.addTag({ label: "hello" });
			expect(tag.label).toBe("HELLO");
		});

		test("after hook receives the transformed input and created tag", async () => {
			const after = vi.fn();
			const storage = new MemoryStorageAdapter<TagWithLabel>();
			const server = createServer({
				storage,
				plugins: [use<TagWithLabel>({ hooks: { addTag: { after } } })],
			});
			const tag = await server.addTag({ label: "hook-test" });
			expect(after).toHaveBeenCalledWith(expect.anything(), tag);
		});
	});

	suite("plugin custom API", () => {
		const MY_PLUGIN_NS: unique symbol = Symbol("my-plugin");

		test("exposes custom API under the plugin namespace symbol", async () => {
			const storage = new MemoryStorageAdapter();
			const plugin: TagikonPlugin<Tag, typeof MY_PLUGIN_NS, { greet(): string }> = {
				namespace: MY_PLUGIN_NS,
				api: {
					greet(_ctx) {
						return "hello";
					},
				},
			};
			const server = createServer({ storage, plugins: [use(plugin)] });
			expect(server[MY_PLUGIN_NS].greet()).toBe("hello");
		});

		test("custom API receives ctx with storage access", async () => {
			const storage = new MemoryStorageAdapter();
			const plugin: TagikonPlugin<Tag, typeof MY_PLUGIN_NS, { countTags(): Promise<number> }> = {
				namespace: MY_PLUGIN_NS,
				permissions: { permissions: ["tag:read"] },
				api: {
					async countTags(ctx) {
						const tags = await ctx.storage.listTags();
						return tags.length;
					},
				},
			};
			const server = createServer({
				storage,
				plugins: [use(plugin, { permissions: ["tag:read"] })],
			});
			await server.addTag({});
			await server.addTag({});
			expect(await server[MY_PLUGIN_NS].countTags()).toBe(2);
		});
	});

	suite("plugin extension (TagImplement)", () => {
		interface TagWithDesc extends Tag {
			readonly description: string;
		}

		test("addTag propagates plugin fields through transform", async () => {
			const storage = new MemoryStorageAdapter<TagWithDesc>();
			const server = createServer({
				storage,
				plugins: [
					use<TagWithDesc>({
						hooks: {
							addTag: {
								transform(input) {
									return { ...input, description: input.description ?? "" };
								},
							},
						},
					}),
				],
			});
			const tag = await server.addTag({ description: "hello" });
			expect(tag.description).toBe("hello");
		});
	});
});
