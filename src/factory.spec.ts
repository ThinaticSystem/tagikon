import type { Tag } from "./core/tag.ts";
import type { ExtensionStorageView } from "./plugin/extension/context.ts";
import type { Extension } from "./plugin/extension/types.ts";
import type { Uuid } from "./plugins/id-providers/uuid-id-provider/index.ts";
import type { Permission } from "./security/permission.ts";

import { expect, suite, test, vi } from "vitest";

import { TagNotFoundError } from "./core/errors.ts";
import { objectKey } from "./core/ids.ts";
import { setupTagikon } from "./factory.ts";
import { use } from "./plugin/extension/use.ts";
import { uuid, UUID_ID_PROVIDER } from "./plugins/id-providers/uuid-id-provider/index.ts";
import { MapStorageAdapter } from "./plugins/storage-adapters/map-storage-adapter/index.ts";
import { PermissionDeniedError } from "./security/permission.ts";

interface TagWithLabel extends Tag<Uuid> {
	readonly label: string;
}

const makeTagikon = () => {
	const storage = new MapStorageAdapter<TagWithLabel>(UUID_ID_PROVIDER);
	const tagikon = setupTagikon({ storageAdapter: storage });
	return { tagikon, storage };
};

suite("setupTagikon", () => {
	suite("addTag", () => {
		test("creates a tag with the given attributes", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "work" });
			expect(tag.label).toBe("work");
			expect(tag.id).toBeDefined();
		});
	});

	suite("listTags", () => {
		test("returns all tags", async () => {
			const { tagikon } = makeTagikon();
			await tagikon.addTag({ label: "a" });
			await tagikon.addTag({ label: "b" });
			const tags = await tagikon.listTags();
			expect(tags).toHaveLength(2);
		});
	});

	suite("editTag", () => {
		test("updates the tag attributes", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "old" });
			const updated = await tagikon.editTag(tag.id, { label: "new" });
			expect(updated.label).toBe("new");
		});

		test("throws TagNotFoundError for unknown id", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "tmp" });
			await tagikon.deleteTag(tag.id);

			await expect(tagikon.editTag(tag.id, { label: "x" })).rejects.toBeInstanceOf(
				TagNotFoundError,
			);
		});
	});

	suite("deleteTag", () => {
		test("deletes a tag", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "bye" });
			const result = await tagikon.deleteTag(tag.id);

			expect(result).toBe(true);
			expect(await tagikon.listTags()).toHaveLength(0);
		});

		test("returns false for unknown id", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "tmp" });
			const result1 = await tagikon.deleteTag(tag.id);
			expect(result1).toBe(true);

			const result2 = await tagikon.deleteTag(tag.id);
			expect(result2).toBe(false);
		});
	});

	suite("tagObjects / untagObjects", () => {
		test("tags and untags objects", async () => {
			const { tagikon, storage } = makeTagikon();
			const tag = await tagikon.addTag({ label: "photos" });
			await tagikon.tagObjects(tag.id, [objectKey("img1"), objectKey("img2")]);
			expect(await storage.listTagObjects(tag.id)).toHaveLength(2);

			await tagikon.untagObjects(tag.id, [objectKey("img1")]);
			expect(await storage.listTagObjects(tag.id)).toEqual([objectKey("img2")]);
		});
	});

	suite("resetWithTags", () => {
		test("replaces object tags with the given set", async () => {
			const { tagikon, storage } = makeTagikon();
			const t1 = await tagikon.addTag({ label: "t1" });
			const t2 = await tagikon.addTag({ label: "t2" });
			const t3 = await tagikon.addTag({ label: "t3" });

			await tagikon.tagObjects(t1.id, [objectKey("file")]);
			await tagikon.tagObjects(t2.id, [objectKey("file")]);
			await tagikon.resetWithTags(objectKey("file"), [t2.id, t3.id]);

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
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithLabel>(UUID_ID_PROVIDER),
				extensions: [use<TagWithLabel>({ hooks: { addTag: { tapRaw } } })],
			});
			await tagikon.addTag({ label: "observe" });
			expect(tapRaw).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ label: "observe" }),
			);
		});

		test("transform can mutate the input before storage write", async () => {
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithLabel>(UUID_ID_PROVIDER),
				extensions: [
					use<TagWithLabel>({
						hooks: {
							addTag: {
								transform(_ctx, input) {
									return { ...input, label: input.label.toUpperCase() };
								},
							},
						},
					}),
				],
			});
			const tag = await tagikon.addTag({ label: "hello" });
			expect(tag.label).toBe("HELLO");
		});

		test("after hook receives the transformed input and created tag", async () => {
			const after = vi.fn();
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithLabel>(UUID_ID_PROVIDER),
				extensions: [use<TagWithLabel>({ hooks: { addTag: { after } } })],
			});
			const tag = await tagikon.addTag({ label: "hook-test" });
			expect(after).toHaveBeenCalledWith(expect.anything(), expect.anything(), tag);
		});
	});

	suite("extension custom API", () => {
		const MY_EXTENSION_NS: unique symbol = Symbol("my-extension");

		test("exposes custom API under the extension namespace symbol", async () => {
			const extension: Extension<Tag<Uuid>, typeof MY_EXTENSION_NS, { greet(): string }> = {
				namespace: MY_EXTENSION_NS,
				api: {
					greet(_ctx) {
						return "hello";
					},
				},
			};
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
				extensions: [use(extension)],
			});
			expect(tagikon[MY_EXTENSION_NS].greet()).toBe("hello");
		});

		test("custom API receives ctx with storage access", async () => {
			const extension: Extension<
				Tag<Uuid>,
				typeof MY_EXTENSION_NS,
				{ countTags(): Promise<number> }
			> = {
				namespace: MY_EXTENSION_NS,
				permissions: { permissions: ["tag:read"] },
				api: {
					async countTags(ctx) {
						const tags = await ctx.storage.listTags();
						return tags.length;
					},
				},
			};
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
				extensions: [use(extension, { permissions: ["tag:read"] })],
			});
			await tagikon.addTag({});
			await tagikon.addTag({});
			expect(await tagikon[MY_EXTENSION_NS].countTags()).toBe(2);
		});
	});

	suite("nested (private) extensions", () => {
		test("descendant extension hooks always run on root operations", async () => {
			const upperCase: Extension<TagWithLabel> = {
				hooks: {
					addTag: {
						transform(_ctx, input) {
							return { ...input, label: input.label.toUpperCase() };
						},
					},
				},
			};

			const wrapper: Extension<TagWithLabel> = {
				extensions: [use<TagWithLabel>(upperCase)],
			};

			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithLabel>(UUID_ID_PROVIDER),
				extensions: [use<TagWithLabel>(wrapper)],
			});

			const tag = await tagikon.addTag({ label: "hello" });
			expect(tag.label).toBe("HELLO");
		});

		test("descendant extension API is accessible via ctx.api[namespace] without cast", async () => {
			const COUNTER_NS: unique symbol = Symbol("counter");
			interface CounterAux {
				readonly count: number;
			}
			const COUNTER_KEY = uuid("singleton");
			const counter: Extension<
				Tag<Uuid>,
				typeof COUNTER_NS,
				{ getCount(): Promise<number> },
				CounterAux
			> = {
				namespace: COUNTER_NS,
				hooks: {
					addTag: {
						async after(ctx) {
							const current = (await ctx.aux.find(COUNTER_KEY))?.count ?? 0;
							await ctx.aux.put(COUNTER_KEY, { count: current + 1 });
						},
					},
				},
				api: {
					async getCount(ctx) {
						return (await ctx.aux.find(COUNTER_KEY))?.count ?? 0;
					},
				},
			};

			const WRAPPER_NS: unique symbol = Symbol("wrapper");
			type CounterChildrenApi = {
				readonly [K in typeof COUNTER_NS]: { getCount(): Promise<number> };
			};
			const wrapper: Extension<
				Tag<Uuid>,
				typeof WRAPPER_NS,
				{ total(): Promise<number> },
				unknown,
				CounterChildrenApi
			> = {
				namespace: WRAPPER_NS,
				extensions: [use(counter)],
				api: {
					total(ctx) {
						return ctx.api[COUNTER_NS].getCount();
					},
				},
			};

			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
				extensions: [use(wrapper)],
			});

			await tagikon.addTag({});
			await tagikon.addTag({});

			expect(await tagikon[WRAPPER_NS].total()).toBe(2);
		});

		test("descendant namespace is NOT exposed on the top-level tagikon object", async () => {
			const PRIVATE_NS: unique symbol = Symbol("private");
			const privateExt: Extension<Tag<Uuid>, typeof PRIVATE_NS, { secret(): string }> = {
				namespace: PRIVATE_NS,
				api: { secret: (_ctx) => "shhh" },
			};

			type PrivateChildrenApi = {
				readonly [K in typeof PRIVATE_NS]: { secret(): string };
			};
			const PUBLIC_NS: unique symbol = Symbol("public");
			const publicExt: Extension<
				Tag<Uuid>,
				typeof PUBLIC_NS,
				{ getSecret(): string },
				unknown,
				PrivateChildrenApi
			> = {
				namespace: PUBLIC_NS,
				extensions: [use(privateExt)],
				api: {
					getSecret(ctx) {
						return ctx.api[PRIVATE_NS].secret();
					},
				},
			};

			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
				extensions: [use(publicExt)],
			});

			expect(tagikon[PUBLIC_NS].getSecret()).toBe("shhh");
			expect((tagikon as unknown as Record<symbol, unknown>)[PRIVATE_NS]).toBeUndefined();
		});

		test("each extension's aux is isolated from siblings", async () => {
			const A_NS: unique symbol = Symbol("a");
			const B_NS: unique symbol = Symbol("b");

			const extA: Extension<
				Tag<Uuid>,
				typeof A_NS,
				{ markFirst(): Promise<void>; ownAuxSize(): Promise<number> }
			> = {
				namespace: A_NS,
				permissions: { permissions: ["tag:read"] },
				api: {
					async markFirst(ctx) {
						const tags = await ctx.storage.listTags();
						const first = tags[0];
						if (first) await ctx.aux.put(first.id, { who: "A" });
					},
					async ownAuxSize(ctx) {
						return (await ctx.aux.list()).length;
					},
				},
			};
			const extB: Extension<Tag<Uuid>, typeof B_NS, { ownAuxSize(): Promise<number> }> = {
				namespace: B_NS,
				api: {
					async ownAuxSize(ctx) {
						return (await ctx.aux.list()).length;
					},
				},
			};

			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
				extensions: [use(extA, { permissions: ["tag:read"] }), use(extB)],
			});

			await tagikon.addTag({});
			await tagikon[A_NS].markFirst();
			expect(await tagikon[A_NS].ownAuxSize()).toBe(1);
			expect(await tagikon[B_NS].ownAuxSize()).toBe(0);
		});
	});

	suite("extension (TagImplement)", () => {
		interface TagWithDesc extends Tag<Uuid> {
			readonly description: string;
		}

		test("addTag propagates extension fields through transform", async () => {
			const tagikon = setupTagikon({
				storageAdapter: new MapStorageAdapter<TagWithDesc>(UUID_ID_PROVIDER),
				extensions: [
					use<TagWithDesc>({
						hooks: {
							addTag: {
								transform(_ctx, input) {
									return { ...input, description: input.description ?? "" };
								},
							},
						},
					}),
				],
			});
			const tag = await tagikon.addTag({ description: "hello" });
			expect(tag.description).toBe("hello");
		});
	});

	suite("permission enforcement", () => {
		const NS: unique symbol = Symbol("perm-test");

		type StorageCall = (storage: ExtensionStorageView<Tag<Uuid>>) => Promise<unknown>;

		const storageApiMatrix: Array<{
			method: string;
			permission: Permission;
			call: StorageCall;
		}> = [
			{ method: "listTags", permission: "tag:read", call: (s) => s.listTags() },
			{ method: "getTag", permission: "tag:read", call: (s) => s.getTag(uuid("dummy")) },
			{ method: "createTag", permission: "tag:write", call: (s) => s.createTag({}) },
			{
				method: "updateTag",
				permission: "tag:write",
				call: (s) => s.updateTag(uuid("dummy"), {}),
			},
			{ method: "deleteTag", permission: "tag:write", call: (s) => s.deleteTag(uuid("dummy")) },
			{
				method: "addRelations",
				permission: "relation:write",
				call: (s) => s.addRelations(uuid("dummy"), [objectKey("x")]),
			},
			{
				method: "removeRelations",
				permission: "relation:write",
				call: (s) => s.removeRelations(uuid("dummy"), [objectKey("x")]),
			},
			{
				method: "listObjectTags",
				permission: "relation:read",
				call: (s) => s.listObjectTags(objectKey("x")),
			},
			{
				method: "listTagObjects",
				permission: "relation:read",
				call: (s) => s.listTagObjects(uuid("dummy")),
			},
		];

		test.each(storageApiMatrix)(
			"throws PermissionDeniedError for ctx.storage.$method when $permission is not granted",
			async ({ permission, call }) => {
				let caught: unknown = null;
				const ext: Extension<Tag<Uuid>, typeof NS, { run(): Promise<void> }> = {
					namespace: NS,
					api: {
						async run(ctx) {
							try {
								await call(ctx.storage);
							} catch (e) {
								caught = e;
							}
						},
					},
				};
				const tagikon = setupTagikon({
					storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
					extensions: [use(ext)],
				});
				await tagikon[NS].run();
				expect(caught).toBeInstanceOf(PermissionDeniedError);
				expect((caught as PermissionDeniedError).permission).toBe(permission);
			},
		);

		test.each(storageApiMatrix)(
			"does not throw PermissionDeniedError for ctx.storage.$method when $permission is granted",
			async ({ permission, call }) => {
				let accessDenied = false;
				const ext: Extension<Tag<Uuid>, typeof NS, { run(): Promise<void> }> = {
					namespace: NS,
					permissions: { permissions: [permission] },
					api: {
						async run(ctx) {
							try {
								await call(ctx.storage);
							} catch (e) {
								if (e instanceof PermissionDeniedError) accessDenied = true;
							}
						},
					},
				};
				const tagikon = setupTagikon({
					storageAdapter: new MapStorageAdapter<Tag<Uuid>>(UUID_ID_PROVIDER),
					extensions: [use(ext, { permissions: [permission] })],
				});
				await tagikon[NS].run();
				expect(accessDenied).toBe(false);
			},
		);
	});
});
