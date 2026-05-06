import type { ApiShape, Extension, IdOf, Tag } from "@tagikon/core";

/**
 * Tag type extended with an `isDeleted` flag.\
 * Intersect into your tag shape to use {@link createSoftDelete}.
 *
 * @example
 * ```ts
 * type MyTag = TagWithSoftDelete<Uuid> & { readonly name: string };
 * ```
 */
export interface TagWithSoftDelete<TId> extends Tag<TId> {
	readonly isDeleted: boolean;
}

/**
 * Namespace symbol under which {@link SoftDeleteApi} is exposed on the
 * Tagikon root object.
 */
export const SOFT_DELETE_NS: unique symbol = Symbol("soft-delete");

/**
 * Custom API exposed by `extension-soft-delete`.\
 * Available on the Tagikon root object as `tagikon[SOFT_DELETE_NS]`.
 */
export interface SoftDeleteApi<TId> extends ApiShape {
	/**
	 * Marks a tag as soft-deleted.
	 *
	 * @returns `true` if the tag was newly soft-deleted, `false` if it
	 *   did not exist or was already soft-deleted (no-op).
	 */
	softDeleteTag: (id: TId) => Promise<boolean>;
	/** @returns Every tag with `isDeleted: true`. */
	listSoftDeletedTags: () => Promise<TagWithSoftDelete<TId>[]>;
	/** Restores a previously soft-deleted tag. No-op if it was not deleted. */
	restoreTag: (id: TId) => Promise<void>;
}

/**
 * Builds the soft-delete extension.\
 * Hooks installed:
 *
 * - `addTag.transform` — supplies `isDeleted: false` for new tags.
 * - `listTags.transformOutput` — filters out soft-deleted tags.
 *
 * Note: `findObjects` / `countObjects` are **not** filtered yet —
 * objects tagged with a soft-deleted tag still appear in those results.
 * This is a known limitation tracked in the project's open design items.
 *
 * Required permissions (declare them when calling `use()`):
 * `["tag:read", "tag:write"]`.
 *
 * @example
 * ```ts
 * import { createSoftDelete, SOFT_DELETE_NS } from "@tagikon/extension-soft-delete";
 * import { setupTagikon, use } from "@tagikon/core";
 *
 * const tagikon = setupTagikon({
 *   tagShape,
 *   storageAdapter,
 *   extensions: [use(createSoftDelete(), { permissions: ["tag:read", "tag:write"] })],
 * });
 *
 * await tagikon[SOFT_DELETE_NS].softDeleteTag(someTagId);
 * ```
 */
export const createSoftDelete = <TTag extends TagWithSoftDelete<unknown>>(): Extension<
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
			const all = (await ctx.storage.listTags()) as TagWithSoftDelete<IdOf<TTag>>[];
			return all.filter((tag) => tag.isDeleted);
		},
		async restoreTag(ctx, id) {
			await ctx.storage.updateTag(id, {
				isDeleted: false,
			} as Partial<Omit<TTag, "id">>);
		},
	},
});
