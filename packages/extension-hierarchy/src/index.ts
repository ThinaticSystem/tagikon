import type { ApiShape, Extension, IdOf, Tag } from "@tagikon/core";

import { TagNotFoundError, TagikonError } from "@tagikon/core";

/**
 * Namespace symbol under which {@link HierarchyApi} is exposed on the
 * Tagikon root object.
 */
export const HIERARCHY_NS: unique symbol = Symbol("hierarchy");

/**
 * @internal
 */
interface HierarchyAux<TId> {
	readonly parentId: null | TId;
}

/**
 * Thrown by {@link HierarchyApi.moveTag} when the requested move would
 * create a cycle (i.e. `parentId` is already a descendant of `id`).
 *
 * @typeParam TId - ID type of the tag being moved.
 */
export class HierarchyCycleError<TId> extends TagikonError {
	readonly name = "HierarchyCycleError";
	readonly tagId: TId;
	readonly targetParentId: TId;

	constructor(tagId: TId, targetParentId: TId) {
		super(
			`Cycle detected: tag "${String(tagId)}" cannot be moved under "${String(targetParentId)}"`,
		);
		this.tagId = tagId;
		this.targetParentId = targetParentId;
	}
}

/**
 * Custom API exposed by `extension-hierarchy`.\
 * Available on the Tagikon root object as `tagikon[HIERARCHY_NS]`.\
 * Parent/child relationships are stored in the extension's AuxStore,
 * keyed by tag ID; the core `Tag` type is not modified.
 */
export interface HierarchyApi<TId> extends ApiShape {
	/**
	 * Sets the parent of a tag. Pass `null` to make the tag a root.
	 *
	 * @throws `TagNotFoundError` if `id` or `parentId` does not exist.
	 * @throws {@link HierarchyCycleError} if `parentId` is already a
	 *   descendant of `id`.
	 */
	moveTag: (id: TId, parentId: null | TId) => Promise<void>;
	/**
	 * Lists the direct children of `parentId`.\
	 * Pass `null` to list root-level tags.
	 */
	listChildren: (parentId: null | TId) => Promise<TId[]>;
	/**
	 * @returns The parent tag's ID, or `null` if the tag is a root.
	 * @throws `TagNotFoundError` if `id` does not exist.
	 */
	getParent: (id: TId) => Promise<null | TId>;
	/**
	 * @returns IDs of every ancestor, ordered nearest-first
	 *   (parent, grandparent, ..., root). Empty if the tag is a root.
	 */
	listAncestors: (id: TId) => Promise<TId[]>;
	/**
	 * @returns IDs of every descendant in breadth-first order.\
	 *   Empty if the tag has no children.
	 */
	listDescendants: (id: TId) => Promise<TId[]>;
}

/**
 * Builds the hierarchy extension.\
 * Hooks installed:
 *
 * - `addTag.after` — initializes the new tag's parent to `null`.
 * - `removeTag.after` — promotes the deleted tag's children to roots
 *   (sets their `parentId` to `null`) and clears its own AuxStore entry.
 *
 * Required permissions (declare them when calling `use()`):
 * `["tag:read", "tag:write"]`.
 *
 * @example
 * ```ts
 * import { createHierarchy, HIERARCHY_NS } from "@tagikon/extension-hierarchy";
 * import { setupTagikon, use } from "@tagikon/core";
 *
 * const tagikon = setupTagikon({
 *   tagShape,
 *   storageAdapter,
 *   extensions: [use(createHierarchy(), { permissions: ["tag:read", "tag:write"] })],
 * });
 *
 * await tagikon[HIERARCHY_NS].moveTag(child, parent);
 * const descendants = await tagikon[HIERARCHY_NS].listDescendants(parent);
 * ```
 */
export const createHierarchy = <TTag extends Tag>(): Extension<
	TTag,
	typeof HIERARCHY_NS,
	HierarchyApi<IdOf<TTag>>,
	HierarchyAux<IdOf<TTag>>
> => ({
	namespace: HIERARCHY_NS,
	permissions: { permissions: ["tag:read", "tag:write"] },
	hooks: {
		addTag: {
			after: async (ctx, _input, output) => {
				await ctx.aux.put(output.id as IdOf<TTag>, { parentId: null });
			},
		},
		removeTag: {
			after: async (ctx, input, deleted) => {
				if (!deleted) return;

				const all = await ctx.aux.list();
				for (const [childId, data] of all) {
					if (data.parentId === input.id) {
						await ctx.aux.patch(childId, { parentId: null });
					}
				}
				await ctx.aux.delete(input.id);
			},
		},
	},
	api: {
		async moveTag(ctx, id, parentId) {
			const tag = await ctx.storage.getTag(id);
			if (!tag) throw new TagNotFoundError(id);

			if (parentId !== null) {
				// When setting a new parent

				// validate that it exists
				const parentTag = await ctx.storage.getTag(parentId);
				if (!parentTag) throw new TagNotFoundError(parentId);

				// Walk ancestors of newParentId to detect cycles
				let current: null | IdOf<TTag> = parentId;
				while (current !== null) {
					if (current === id) throw new HierarchyCycleError(id, parentId);
					const entry = await ctx.aux.find(current);
					current = entry?.parentId ?? null;
				}
			}

			const existing = await ctx.aux.find(id);
			if (existing !== null) {
				await ctx.aux.patch(id, { parentId: parentId });
			} else {
				await ctx.aux.put(id, { parentId: parentId });
			}
		},

		async listChildren(ctx, parentId) {
			const all = await ctx.aux.list();
			return all
				.values()
				.filter(([, data]) => data.parentId === parentId)
				.map(([childId]) => childId)
				.toArray();
		},

		async getParent(ctx, id) {
			const entry = await ctx.aux.find(id);
			if (!entry) throw new TagNotFoundError(id);

			return entry.parentId ?? null;
		},

		async listAncestors(ctx, id) {
			const ancestors: IdOf<TTag>[] = [];
			let current = id;

			while (true) {
				const entry = await ctx.aux.find(current);
				if (entry === null) break;
				const parentId = entry.parentId;
				if (parentId === null) break;
				ancestors.push(parentId);
				current = parentId;
			}

			return ancestors;
		},

		async listDescendants(ctx, id) {
			const all = await ctx.aux.list();

			const childrenMap = new Map<IdOf<TTag> | null, IdOf<TTag>[]>();
			for (const [childId, data] of all) {
				const pId = data.parentId;
				const existing = childrenMap.get(pId);
				if (existing !== undefined) {
					existing.push(childId);
				} else {
					childrenMap.set(pId, [childId]);
				}
			}

			const result: IdOf<TTag>[] = [];
			const queue: IdOf<TTag>[] = [...(childrenMap.get(id) ?? [])];
			while (queue.length > 0) {
				const current = queue.shift();
				if (current === undefined) break;
				result.push(current);
				const children = childrenMap.get(current);
				if (children !== undefined) queue.push(...children);
			}

			return result;
		},
	},
});
