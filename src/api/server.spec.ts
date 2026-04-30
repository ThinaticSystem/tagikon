import type { Tag } from "../core/tag.ts";
import type { TaginkonPlugin } from "../plugin/types.ts";

import { expect, suite, test, vi } from "vitest";

import { TagAlreadyExistsError, TagNotFoundError } from "../core/errors.ts";
import { objectKey } from "../core/ids.ts";
import { TAG_KIND } from "../core/tag-kind.ts";
import { use } from "../plugin/use.ts";
import { MemoryStorageAdapter } from "../storage/memory.ts";
import { createServer } from "./server.ts";

const ok = (s: string) => objectKey(s);

function makeServer() {
	const storage = new MemoryStorageAdapter();
	const server = createServer({ storage });
	return { server, storage };
}

suite("Server", () => {
	suite("addTag", () => {
		test("creates a tag with default kind=user", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("work");
			expect(tag.name).toBe("work");
			expect(tag.kind).toBe(TAG_KIND.USER);
		});

		test("respects explicit kind", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("sys", { kind: TAG_KIND.SYSTEM });
			expect(tag.kind).toBe(TAG_KIND.SYSTEM);
		});

		test("throws TagAlreadyExistsError on duplicate name", async () => {
			const { server } = makeServer();
			await server.addTag("dup");
			await expect(server.addTag("dup")).rejects.toBeInstanceOf(TagAlreadyExistsError);
		});
	});

	suite("listTags", () => {
		test("returns all tags", async () => {
			const { server } = makeServer();
			await server.addTag("a");
			await server.addTag("b");
			const tags = await server.listTags();
			expect(tags).toHaveLength(2);
		});
	});

	suite("editTag", () => {
		test("updates the tag name", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("old");
			const updated = await server.editTag(tag.id, { name: "new" });
			expect(updated.name).toBe("new");
		});

		test("throws TagNotFoundError for unknown id", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("tmp");
			await server.deleteTag(tag.id);

			await expect(server.editTag(tag.id, { name: "x" })).rejects.toBeInstanceOf(TagNotFoundError);
		});
	});

	suite("deleteTag", () => {
		test("deletes a tag", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("bye");
			const result = await server.deleteTag(tag.id);

			expect(result).toBe(true);
			expect(await server.listTags()).toHaveLength(0);
		});

		test("returns false for unknown id", async () => {
			const { server } = makeServer();
			const tag = await server.addTag("tmp");
			const result1 = await server.deleteTag(tag.id);
			expect(result1).toBe(true);

			const result2 = await server.deleteTag(tag.id);
			expect(result2).toBe(false);
		});
	});

	suite("tagObjects / untagObjects", () => {
		test("tags and untags objects", async () => {
			const { server, storage } = makeServer();
			const tag = await server.addTag("photos");
			await server.tagObjects(tag.id, [ok("img1"), ok("img2")]);
			expect(await storage.listTagObjects(tag.id)).toHaveLength(2);

			await server.untagObjects(tag.id, [ok("img1")]);
			expect(await storage.listTagObjects(tag.id)).toEqual([ok("img2")]);
		});
	});

	suite("resetWithTags", () => {
		test("replaces object tags with the given set", async () => {
			const { server, storage } = makeServer();
			const t1 = await server.addTag("t1");
			const t2 = await server.addTag("t2");
			const t3 = await server.addTag("t3");

			await server.tagObjects(t1.id, [ok("file")]);
			await server.tagObjects(t2.id, [ok("file")]);
			// file has t1, t2 — reset to t2, t3
			await server.resetWithTags(ok("file"), [t2.id, t3.id]);

			const objectTags = await storage.listObjectTags(ok("file"));
			expect(objectTags).toHaveLength(2);
			expect(objectTags).toContain(t2.id);
			expect(objectTags).toContain(t3.id);
			expect(objectTags).not.toContain(t1.id);
		});
	});

	suite("hooks", () => {
		test("tapRaw is called before transform with the original input", async () => {
			const tapRaw = vi.fn();
			const storage = new MemoryStorageAdapter();
			const server = createServer({
				storage,
				plugins: [use({ addTag: { tapRaw } })],
			});
			await server.addTag("observe");
			expect(tapRaw).toHaveBeenCalledWith(expect.objectContaining({ name: "observe" }));
		});

		test("transform can mutate the input before storage write", async () => {
			const storage = new MemoryStorageAdapter();
			const server = createServer({
				storage,
				plugins: [
					use({
						addTag: {
							transform(input) {
								return { ...input, name: input.name.toUpperCase() };
							},
						},
					}),
				],
			});
			const tag = await server.addTag("hello");
			expect(tag.name).toBe("HELLO");
		});

		test("after hook receives the transformed input and created tag", async () => {
			const after = vi.fn();
			const storage = new MemoryStorageAdapter();
			const server = createServer({
				storage,
				plugins: [use({ addTag: { after } })],
			});
			const tag = await server.addTag("hook-test");
			expect(after).toHaveBeenCalledWith(expect.anything(), tag);
		});
	});

	suite("plugin custom API", () => {
		const MY_PLUGIN_NS: unique symbol = Symbol("my-plugin");

		test("exposes custom API under the plugin namespace symbol", async () => {
			const storage = new MemoryStorageAdapter();
			const plugin: TaginkonPlugin<Tag, typeof MY_PLUGIN_NS, { greet(): string }> = {
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
			const plugin: TaginkonPlugin<Tag, typeof MY_PLUGIN_NS, { countTags(): Promise<number> }> = {
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
			await server.addTag("a");
			await server.addTag("b");
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
						addTag: {
							transform(input) {
								return { ...input, description: input.description ?? "" };
							},
						},
					}),
				],
			});
			const tag = await server.addTag("extended", { description: "hello" });
			expect(tag.description).toBe("hello");
		});
	});
});
