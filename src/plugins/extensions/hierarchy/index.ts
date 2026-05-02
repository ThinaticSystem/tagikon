import type { IdOf, Tag } from "../../../core/tag.ts";
import type { ApiShape, Extension } from "../../../plugin/extension/types.ts";

import { TagNotFoundError, TagikonError } from "../../../core/errors.ts";

export const HIERARCHY_NS: unique symbol = Symbol("hierarchy");

interface HierarchyAux<TId> {
	readonly parentId: null | TId;
}

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

export interface HierarchyApi<TId> extends ApiShape {
	moveTag: (id: TId, parentId: null | TId) => Promise<void>;
	listChildren: (parentId: null | TId) => Promise<TId[]>;
	getParent: (id: TId) => Promise<null | TId>;
	listAncestors: (id: TId) => Promise<TId[]>;
	listDescendants: (id: TId) => Promise<TId[]>;
}

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
			if (!tag) throw new TagNotFoundError(id as never);

			if (parentId !== null) {
				// When setting a new parent

				// validate that it exists
				const parentTag = await ctx.storage.getTag(parentId);
				if (!parentTag) throw new TagNotFoundError(parentId as never);

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
			if (!entry) throw new TagNotFoundError(id as never);

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
