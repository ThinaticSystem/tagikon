import type { Tag } from "@tagikon/core";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { TagNotFoundError, setupTagikon, use } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import { HIERARCHY_NS, HierarchyCycleError, createHierarchy } from "./index.ts";

const setup = () => {
	const storage = new MapStorageAdapter<Tag<Uuid>>();
	const extension = createHierarchy<Tag<Uuid>>();
	const tagikon = setupTagikon({
		tagShape: { id: UUID_ID_PROVIDER },
		storageAdapter: storage,
		extensions: [use(extension, { permissions: ["tag:read", "tag:write"] })],
	});
	return { storage, tagikon };
};

suite("createHierarchy", () => {
	suite("addTag", () => {
		test("newly added tag has no parent", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});
			const parent = await tagikon[HIERARCHY_NS].getParent(tag.id);
			expect(parent).toBeNull();
		});
	});

	suite("moveTag", () => {
		test("sets a parent for a tag", async () => {
			const { tagikon } = setup();
			const parent = await tagikon.addTag({});
			const child = await tagikon.addTag({});

			await tagikon[HIERARCHY_NS].moveTag(child.id, parent.id);

			const result = await tagikon[HIERARCHY_NS].getParent(child.id);
			expect(result).toBe(parent.id);
		});

		test("moves tag back to root by passing null", async () => {
			const { tagikon } = setup();
			const parent = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(child.id, parent.id);

			await tagikon[HIERARCHY_NS].moveTag(child.id, null);

			const result = await tagikon[HIERARCHY_NS].getParent(child.id);
			expect(result).toBeNull();
		});

		test("reparents to a different tag", async () => {
			const { tagikon } = setup();
			const parentA = await tagikon.addTag({});
			const parentB = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(child.id, parentA.id);

			await tagikon[HIERARCHY_NS].moveTag(child.id, parentB.id);

			const result = await tagikon[HIERARCHY_NS].getParent(child.id);
			expect(result).toBe(parentB.id);
		});

		test("throws HierarchyCycleError when moving a tag under itself", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});

			await expect(tagikon[HIERARCHY_NS].moveTag(tag.id, tag.id)).rejects.toBeInstanceOf(
				HierarchyCycleError,
			);
		});

		test("throws HierarchyCycleError when moving a tag under its own descendant", async () => {
			const { tagikon } = setup();
			const grandparent = await tagikon.addTag({});
			const parent = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(parent.id, grandparent.id);
			await tagikon[HIERARCHY_NS].moveTag(child.id, parent.id);

			await expect(tagikon[HIERARCHY_NS].moveTag(grandparent.id, child.id)).rejects.toBeInstanceOf(
				HierarchyCycleError,
			);
		});

		test("throws TagNotFoundError when tag does not exist", async () => {
			const { tagikon } = setup();
			const phantom = await tagikon.addTag({});
			await tagikon.deleteTag(phantom.id);

			await expect(tagikon[HIERARCHY_NS].moveTag(phantom.id, null)).rejects.toBeInstanceOf(
				TagNotFoundError,
			);
		});

		test("throws TagNotFoundError when target parent does not exist", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});
			const phantom = await tagikon.addTag({});
			await tagikon.deleteTag(phantom.id);

			await expect(tagikon[HIERARCHY_NS].moveTag(tag.id, phantom.id)).rejects.toBeInstanceOf(
				TagNotFoundError,
			);
		});
	});

	suite("listChildren", () => {
		test("returns direct children of a tag", async () => {
			const { tagikon } = setup();
			const parent = await tagikon.addTag({});
			const childA = await tagikon.addTag({});
			const childB = await tagikon.addTag({});
			const grandchild = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(childA.id, parent.id);
			await tagikon[HIERARCHY_NS].moveTag(childB.id, parent.id);
			await tagikon[HIERARCHY_NS].moveTag(grandchild.id, childA.id);

			const children = await tagikon[HIERARCHY_NS].listChildren(parent.id);
			expect(new Set(children as string[])).toEqual(new Set([childA.id, childB.id]));
		});

		test("returns root-level tags when called with null", async () => {
			const { tagikon } = setup();
			const root = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(child.id, root.id);

			const roots = await tagikon[HIERARCHY_NS].listChildren(null);
			expect(roots).toContain(root.id);
			expect(roots).not.toContain(child.id);
		});

		test("returns empty array for a leaf tag", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});

			const children = await tagikon[HIERARCHY_NS].listChildren(tag.id);
			expect(children).toHaveLength(0);
		});
	});

	suite("listAncestors", () => {
		test("returns empty array for a root tag", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});

			const ancestors = await tagikon[HIERARCHY_NS].listAncestors(tag.id);
			expect(ancestors).toHaveLength(0);
		});

		test("returns ancestor chain from nearest to furthest", async () => {
			const { tagikon } = setup();
			const grandparent = await tagikon.addTag({});
			const parent = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(parent.id, grandparent.id);
			await tagikon[HIERARCHY_NS].moveTag(child.id, parent.id);

			const ancestors = await tagikon[HIERARCHY_NS].listAncestors(child.id);
			expect(ancestors).toEqual([parent.id, grandparent.id]);
		});
	});

	suite("listDescendants", () => {
		test("returns empty array for a leaf tag", async () => {
			const { tagikon } = setup();
			const tag = await tagikon.addTag({});

			const descendants = await tagikon[HIERARCHY_NS].listDescendants(tag.id);
			expect(descendants).toHaveLength(0);
		});

		test("returns all descendants of a tag", async () => {
			const { tagikon } = setup();
			const root = await tagikon.addTag({});
			const childA = await tagikon.addTag({});
			const childB = await tagikon.addTag({});
			const grandchild = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(childA.id, root.id);
			await tagikon[HIERARCHY_NS].moveTag(childB.id, root.id);
			await tagikon[HIERARCHY_NS].moveTag(grandchild.id, childA.id);

			const descendants = await tagikon[HIERARCHY_NS].listDescendants(root.id);
			expect(new Set(descendants as string[])).toEqual(
				new Set([childA.id, childB.id, grandchild.id]),
			);
		});
	});

	suite("removeTag", () => {
		test("orphans direct children when a parent is deleted", async () => {
			const { tagikon } = setup();
			const parent = await tagikon.addTag({});
			const child = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(child.id, parent.id);

			await tagikon.deleteTag(parent.id);

			const result = await tagikon[HIERARCHY_NS].getParent(child.id);
			expect(result).toBeNull();
		});

		test("orphans grandchildren when intermediate parent is deleted", async () => {
			const { tagikon } = setup();
			const root = await tagikon.addTag({});
			const middle = await tagikon.addTag({});
			const leaf = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(middle.id, root.id);
			await tagikon[HIERARCHY_NS].moveTag(leaf.id, middle.id);

			await tagikon.deleteTag(middle.id);

			expect(await tagikon[HIERARCHY_NS].getParent(leaf.id)).toBeNull();
			expect(await tagikon[HIERARCHY_NS].getParent(root.id)).toBeNull();
		});

		test("does not orphan unrelated tags", async () => {
			const { tagikon } = setup();
			const parentA = await tagikon.addTag({});
			const parentB = await tagikon.addTag({});
			const childOfB = await tagikon.addTag({});
			await tagikon[HIERARCHY_NS].moveTag(childOfB.id, parentB.id);

			await tagikon.deleteTag(parentA.id);

			expect(await tagikon[HIERARCHY_NS].getParent(childOfB.id)).toBe(parentB.id);
		});
	});
});
