import type { IdOf, Tag } from "../../../core/tag.ts";
import type { ApiShape, Extension } from "../../../plugin/extension/types.ts";

export interface TagWithSoftDelete extends Tag {
	readonly isDeleted: boolean;
}

export const SOFT_DELETE_NS: unique symbol = Symbol("soft-delete");

export interface SoftDeleteApi<TId> extends ApiShape {
	softDeleteTag: (id: TId) => Promise<boolean>;
	listSoftDeletedTags: () => Promise<TagWithSoftDelete[]>;
	restoreTag: (id: TId) => Promise<void>;
}

export const createSoftDelete = <TTag extends TagWithSoftDelete>(): Extension<
	TTag,
	typeof SOFT_DELETE_NS,
	SoftDeleteApi<IdOf<TTag>>
> => ({
	namespace: SOFT_DELETE_NS,
	permissions: { permissions: ["tag:read", "tag:write"] },
	hooks: {
		addTag: {
			transform: (_ctx, input) => ({ ...input, isDeleted: false }) as unknown as Omit<TTag, "id">,
		},
		listTags: {
			transformOutput: (_ctx, tags) => tags.filter((tag) => !tag.isDeleted),
		},
	},
	api: {
		async softDeleteTag(ctx, id) {
			const tag = await ctx.storage.getTag(id);
			if (!tag || tag.isDeleted) return false;

			await ctx.storage.updateTag(id, {
				isDeleted: true,
			} as Partial<Omit<TTag, "id">>);
			return true;
		},
		async listSoftDeletedTags(ctx) {
			const all = await ctx.storage.listTags();
			return all.filter((tag) => tag.isDeleted);
		},
		async restoreTag(ctx, id) {
			await ctx.storage.updateTag(id, {
				isDeleted: false,
			} as Partial<Omit<TTag, "id">>);
		},
	},
});
