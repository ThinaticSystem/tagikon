import type { ObjectKey } from "../../core/ids.ts";
import type { IdOf, Tag } from "../../core/tag.ts";
import type { TagCondition } from "../../finder/condition.ts";
import type { HookPhases } from "../../hook/types.ts";
import type { Permission, PermissionManifest } from "../../security/permission.ts";
import type { StorageAdapter } from "../storage-adapter/types.ts";
import type { ExtensionContext } from "./context.ts";

//#region Hook input / output type aliases per operation
export type AddTagInput<TTag extends Tag> = Omit<TTag, "id">;

export type EditTagInput<TTag extends Tag> = {
	id: IdOf<TTag>;
	patch: Partial<Omit<TTag, "id">>;
};

export type RemoveTagInput<TTag extends Tag> = { id: IdOf<TTag> };

export type TagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

export type UntagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

export type ResetWithTagsInput<TTag extends Tag> = {
	objectKey: ObjectKey;
	tagIds: readonly IdOf<TTag>[];
};

export type ListTagsInput = Record<never, never>;

export type FindObjectsByTagsInput<TTag extends Tag> = { query: TagCondition<IdOf<TTag>> };
//#endregion

//#region Finder plugin
export interface FinderImplement<TTag extends Tag> {
	findObjectsByTags(
		query: TagCondition<IdOf<TTag>>,
		storage: StorageAdapter<TTag>,
	): Promise<ObjectKey[]>;
}
// #endregion

//#region Custom API
export type ApiShape = Record<string, (...args: readonly unknown[]) => unknown>;

type ApiImplementation<TCtx, TApi extends ApiShape> = {
	readonly [TKey in keyof TApi]: TApi[TKey] extends (...args: infer TArgs) => infer TReturn
		? (ctx: TCtx, ...args: TArgs) => TReturn
		: never;
};
// #endregion

// Stored in Extension.extensions. Per-extension generics (TAux, TChildrenApi) are
// erased here because the parent's view of a child only needs its custom API shape.
export interface ExtensionRegistration<
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
> {
	readonly extension: Extension<Tag, TNamespace, TApi>;
	readonly namespace: null | TNamespace;
	readonly permissions: ReadonlySet<Permission>;
}

//#region Children API derivation (utility for callers)
type UnionToIntersection<TUnion> = (TUnion extends unknown ? (x: TUnion) => void : never) extends (
	x: infer TIntersect,
) => void
	? TIntersect
	: never;

type ApiOfRegistration<TRegistration> =
	TRegistration extends ExtensionRegistration<infer TNamespace, infer TApi>
		? TNamespace extends symbol
			? { readonly [TKey in TNamespace]: TApi }
			: Record<never, never>
		: Record<never, never>;

/**
 * Compute the children-API map type from a tuple of registrations.\
 * Use this to declare the `TChildrenApi` of a parent extension when you want
 * `ctx.api` to be typed without manual annotations.
 */
export type ChildrenApiOf<
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[],
> = UnionToIntersection<ApiOfRegistration<TRegistrations[number]>>;
// #endregion

//#region Extension interface
export interface Extension<
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
	TAux = unknown,
	TChildrenApi = Record<never, never>,
> {
	namespace?: TNamespace;
	/**
	 * Declare permissions your extension requires to function.\
	 * The server will check these against what is granted when registering the extension, and throw if they are not satisfied.
	 */
	permissions?: PermissionManifest;
	/**
	 * Child extensions. They run alongside this extension in the pipeline, but
	 * each owns an isolated AuxStore. Their custom API is exposed to this
	 * extension via `ctx.api[childNamespace]`.
	 *
	 * Direct children of the root extension are exposed on the top-level Tagikon
	 * object; deeper descendants are private to their parent only.
	 *
	 * To get a typed `ctx.api` automatically, declare `TChildrenApi` matching
	 * `ChildrenApiOf<typeof extensionsArray>`.
	 */
	extensions?: readonly ExtensionRegistration<symbol, ApiShape>[];
	hooks?: {
		addTag?: HookPhases<ExtensionContext<TTag, TAux, TChildrenApi>, AddTagInput<TTag>, TTag>;
		listTags?: HookPhases<ExtensionContext<TTag, TAux, TChildrenApi>, ListTagsInput, TTag[]>;
		editTag?: HookPhases<ExtensionContext<TTag, TAux, TChildrenApi>, EditTagInput<TTag>, TTag>;
		removeTag?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			RemoveTagInput<TTag>,
			boolean
		>;
		tagObjects?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			TagObjectsInput<TTag>,
			void
		>;
		untagObjects?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			UntagObjectsInput<TTag>,
			void
		>;
		resetWithTags?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			ResetWithTagsInput<TTag>,
			void
		>;
		findObjectsByTags?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			FindObjectsByTagsInput<TTag>,
			ObjectKey[]
		>;
	};
	finder?: FinderImplement<TTag>;
	api?: ApiImplementation<ExtensionContext<TTag, TAux, TChildrenApi>, TApi>;
}
// #endregion
