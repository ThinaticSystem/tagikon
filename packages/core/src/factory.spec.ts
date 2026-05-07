import type { Tag } from "./core/tag.ts";
import type { ExtensionStorageView } from "./plugin/extension/context.ts";
import type { Extension } from "./plugin/extension/types.ts";
import type { Permission } from "./security/permission.ts";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { uuid, UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test, vi } from "vitest";

import { RequiredPropertyMissingError, TagNotFoundError } from "./core/errors.ts";
import { objectKey } from "./core/ids.ts";
import { setupTagikon } from "./factory.ts";
import { use } from "./plugin/extension/use.ts";
import { tpc } from "./plugin/storage-adapter/codec.ts";
import { not, taggedWithAny, tagsById } from "./query/builders.ts";
import { PermissionDeniedError } from "./security/permission.ts";

interface TagWithLabel extends Tag<Uuid> {
	readonly label: string;
}

const makeTagikon = () => {
	const storage = new MapStorageAdapter<TagWithLabel>();
	const tagikon = setupTagikon({
		tagShape: {
			id: UUID_ID_PROVIDER,
			label: tpc.string(),
		},
		storageAdapter: storage,
	});
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

		test("returns empty array when no tags exist", async () => {
			const { tagikon } = makeTagikon();
			expect(await tagikon.listTags()).toEqual([]);
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

		test("removes associated relations on delete", async () => {
			const { tagikon, storage } = makeTagikon();
			const tag = await tagikon.addTag({ label: "gone" });
			await tagikon.tagObjects(tag.id, [objectKey("file1"), objectKey("file2")]);
			await tagikon.deleteTag(tag.id);

			expect(await storage.listObjectTags(objectKey("file1"))).toHaveLength(0);
			expect(await storage.listObjectTags(objectKey("file2"))).toHaveLength(0);
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

		test("throws TagNotFoundError when tagging with a non-existent tag id", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "tmp" });
			await tagikon.deleteTag(tag.id);

			await expect(tagikon.tagObjects(tag.id, [objectKey("file")])).rejects.toBeInstanceOf(
				TagNotFoundError,
			);
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

		test("clears all tags when called with empty array", async () => {
			const { tagikon, storage } = makeTagikon();
			const t1 = await tagikon.addTag({ label: "t1" });
			const t2 = await tagikon.addTag({ label: "t2" });
			await tagikon.tagObjects(t1.id, [objectKey("file")]);
			await tagikon.tagObjects(t2.id, [objectKey("file")]);

			await tagikon.resetWithTags(objectKey("file"), []);

			expect(await storage.listObjectTags(objectKey("file"))).toHaveLength(0);
		});

		test("is idempotent when called with the current set of tags", async () => {
			const { tagikon, storage } = makeTagikon();
			const t1 = await tagikon.addTag({ label: "t1" });
			const t2 = await tagikon.addTag({ label: "t2" });
			await tagikon.tagObjects(t1.id, [objectKey("file")]);
			await tagikon.tagObjects(t2.id, [objectKey("file")]);

			await tagikon.resetWithTags(objectKey("file"), [t1.id, t2.id]);

			const objectTags = await storage.listObjectTags(objectKey("file"));
			expect(objectTags).toHaveLength(2);
			expect(objectTags).toContain(t1.id);
			expect(objectTags).toContain(t2.id);
		});
	});

	suite("findObjects", () => {
		const setupFindData = async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "tag" });
			await tagikon.tagObjects(tag.id, [objectKey("a"), objectKey("b"), objectKey("c")]);
			return { tagikon, tag };
		};

		test.each([
			{ limit: 0, offset: 0 },
			{ limit: 10, offset: 100 },
		])(
			"returns empty array when limit=$limit offset=$offset yields no results",
			async ({ limit, offset }) => {
				const { tagikon, tag } = await setupFindData();
				const result = await tagikon.findObjects(taggedWithAny(tagsById([tag.id])), {
					limit,
					offset,
				});
				expect(result).toEqual([]);
			},
		);

		test("limit=1 returns only the first sorted result", async () => {
			const { tagikon, tag } = await setupFindData();
			const result = await tagikon.findObjects(taggedWithAny(tagsById([tag.id])), { limit: 1 });
			expect(result).toEqual([objectKey("a")]);
		});

		test("countObjects returns total count regardless of findObjects limit", async () => {
			const { tagikon, tag } = await setupFindData();
			expect(await tagikon.countObjects(taggedWithAny(tagsById([tag.id])))).toBe(3);
		});

		test("not(taggedWithAny(tagsById([]))) returns the universe of all tagged objects", async () => {
			const { tagikon } = makeTagikon();
			const tagA = await tagikon.addTag({ label: "a" });
			const tagB = await tagikon.addTag({ label: "b" });
			await tagikon.tagObjects(tagA.id, [objectKey("doc1")]);
			await tagikon.tagObjects(tagB.id, [objectKey("doc2")]);

			const result = await tagikon.findObjects(not(taggedWithAny(tagsById([]))));
			expect(result).toHaveLength(2);
			expect(result).toContain(objectKey("doc1"));
			expect(result).toContain(objectKey("doc2"));
		});

		test("objects of a deleted tag no longer appear in results", async () => {
			const { tagikon } = makeTagikon();
			const tag = await tagikon.addTag({ label: "tag" });
			await tagikon.tagObjects(tag.id, [objectKey("file1"), objectKey("file2")]);
			await tagikon.deleteTag(tag.id);

			const result = await tagikon.findObjects(taggedWithAny(tagsById([tag.id])));
			expect(result).toHaveLength(0);
		});
	});

	suite("hooks", () => {
		test("tapRaw is called before transform with the original input", async () => {
			const tapRaw = vi.fn();
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
				},
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
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
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
				},
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
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
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
				},
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
				extensions: [use<TagWithLabel>({ hooks: { addTag: { after } } })],
			});
			const tag = await tagikon.addTag({ label: "hook-test" });
			expect(after).toHaveBeenCalledWith(expect.anything(), expect.anything(), tag);
		});

		test("multiple transform hooks chain in registration order", async () => {
			const tagikon = setupTagikon({
				tagShape: { id: UUID_ID_PROVIDER, label: tpc.string() },
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
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
					use<TagWithLabel>({
						hooks: {
							addTag: {
								transform(_ctx, input) {
									return { ...input, label: input.label + "!" };
								},
							},
						},
					}),
				],
			});
			const tag = await tagikon.addTag({ label: "hello" });
			expect(tag.label).toBe("HELLO!");
		});

		test("tapTransformed is called with the already-transformed value", async () => {
			const observed: string[] = [];
			const tagikon = setupTagikon({
				tagShape: { id: UUID_ID_PROVIDER, label: tpc.string() },
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
				extensions: [
					use<TagWithLabel>({
						hooks: {
							addTag: {
								transform(_ctx, input) {
									return { ...input, label: input.label.toUpperCase() };
								},
								tapTransformed(_ctx, input) {
									observed.push(input.label);
								},
							},
						},
					}),
				],
			});
			await tagikon.addTag({ label: "hello" });
			expect(observed).toEqual(["HELLO"]);
		});

		test("removeTag after hook receives the boolean deletion result", async () => {
			const results: boolean[] = [];
			const tagikon = setupTagikon({
				tagShape: { id: UUID_ID_PROVIDER, label: tpc.string() },
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
				extensions: [
					use<TagWithLabel>({
						hooks: {
							removeTag: {
								after(_ctx, _input, deleted) {
									results.push(deleted as boolean);
								},
							},
						},
					}),
				],
			});
			const tag = await tagikon.addTag({ label: "bye" });
			await tagikon.deleteTag(tag.id);
			await tagikon.deleteTag(tag.id); // already gone
			expect(results).toEqual([true, false]);
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
				tagShape: { id: UUID_ID_PROVIDER },
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
				tagShape: { id: UUID_ID_PROVIDER },
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
				},
				storageAdapter: new MapStorageAdapter<TagWithLabel>(),
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
				tagShape: { id: UUID_ID_PROVIDER },
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
				tagShape: { id: UUID_ID_PROVIDER },
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
				tagShape: { id: UUID_ID_PROVIDER },
				storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
				tagShape: {
					id: UUID_ID_PROVIDER,
					description: tpc.string(),
				},
				storageAdapter: new MapStorageAdapter<TagWithDesc>(),
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

	suite("optional properties", () => {
		interface TagWithOptDesc extends Tag<Uuid> {
			readonly label: string;
			readonly description?: string;
		}

		/** `description` is optional */
		const makeTagikonWithOptional = () => {
			const storage = new MapStorageAdapter<TagWithOptDesc>();
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					description: tpc.string().optional(),
				},
				storageAdapter: storage,
			});
			return tagikon;
		};

		test("optional property can be omitted in addTag", async () => {
			const tagikon = makeTagikonWithOptional();
			const tag = await tagikon.addTag({ label: "no-desc" });
			expect(tag.label).toBe("no-desc");
			expect(tag.description).toBeUndefined();
		});

		test("optional property is stored and retrieved when provided", async () => {
			const tagikon = makeTagikonWithOptional();
			const tag = await tagikon.addTag({ label: "with-desc", description: "hello" });
			expect(tag.description).toBe("hello");
		});

		test("throws RequiredPropertyMissingError when required property is absent at runtime", async () => {
			const tagikon = makeTagikonWithOptional();
			await expect(tagikon.addTag({} as unknown as { label: string })).rejects.toBeInstanceOf(
				RequiredPropertyMissingError,
			);
		});

		test("RequiredPropertyMissingError carries the missing property name", async () => {
			const tagikon = makeTagikonWithOptional();
			await expect(tagikon.addTag({} as unknown as { label: string })).rejects.toSatisfy(
				(e: unknown) => e instanceof RequiredPropertyMissingError && e.propertyName === "label",
			);
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
			{
				method: "findObjects",
				permission: "relation:read",
				call: (s) => s.findObjects(taggedWithAny(tagsById([uuid("dummy")]))),
			},
			{
				method: "countObjects",
				permission: "relation:read",
				call: (s) => s.countObjects(taggedWithAny(tagsById([uuid("dummy")]))),
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
					tagShape: { id: UUID_ID_PROVIDER },
					storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
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
					tagShape: { id: UUID_ID_PROVIDER },
					storageAdapter: new MapStorageAdapter<Tag<Uuid>>(),
					extensions: [use(ext, { permissions: [permission] })],
				});
				await tagikon[NS].run();
				expect(accessDenied).toBe(false);
			},
		);
	});
});
