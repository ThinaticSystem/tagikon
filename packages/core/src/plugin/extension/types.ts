import type { ObjectKey } from "../../core/ids.ts";
import type { IdOf, Tag } from "../../core/tag.ts";
import type { HookPhases } from "../../hook/types.ts";
import type { FindObjectsOptions, ObjectQuery } from "../../query/types.ts";
import type { Permission, PermissionManifest } from "../../security/permission.ts";
import type { AuxStore } from "../storage-adapter/aux-store.ts";
import type { AuxCodec } from "../storage-adapter/codec.ts";
import type { ExtensionContext } from "./context.ts";

//#region Hook input / output type aliases per operation

/** Input passed to `addTag` hooks — every shape property except `id`. */
export type AddTagInput<TTag extends Tag> = Omit<TTag, "id">;

/** Input passed to `editTag` hooks — the target `id` plus a partial patch. */
export type EditTagInput<TTag extends Tag> = {
	id: IdOf<TTag>;
	patch: Partial<Omit<TTag, "id">>;
};

/** Input passed to `removeTag` hooks — the target `id`. */
export type RemoveTagInput<TTag extends Tag> = { id: IdOf<TTag> };

/** Input passed to `tagObjects` hooks. */
export type TagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

/** Input passed to `untagObjects` hooks. */
export type UntagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

/** Input passed to `resetWithTags` hooks. */
export type ResetWithTagsInput<TTag extends Tag> = {
	objectKey: ObjectKey;
	tagIds: readonly IdOf<TTag>[];
};

/**
 * Input passed to `listTags` hooks.\
 * `listTags` takes no arguments, but a placeholder is needed so the hook
 * type can use the standard `(ctx, input) => ...` signature.
 */
export type ListTagsInput = Record<never, never>;

/** Input passed to `findObjects` hooks. */
export type FindObjectsInput<TTag extends Tag> = {
	query: ObjectQuery<IdOf<TTag>>;
	options: FindObjectsOptions | undefined;
};

/** Input passed to `countObjects` hooks. */
export type CountObjectsInput<TTag extends Tag> = {
	query: ObjectQuery<IdOf<TTag>>;
};
//#endregion

//#region Custom API

/**
 * Shape of an extension's custom API surface — a record of arbitrary
 * methods. Each method's first argument is later wrapped with
 * `ctx: ExtensionContext` by the runtime, so the `ApiShape` types
 * describe the **public** surface (without `ctx`).
 */
export type ApiShape = Record<string, (...args: any[]) => unknown>;

/**
 * @internal
 */
type ApiImplementation<TCtx, TApi extends ApiShape> = {
	readonly [TKey in keyof TApi]: TApi[TKey] extends (...args: infer TArgs) => infer TReturn
		? (ctx: TCtx, ...args: TArgs) => TReturn
		: never;
};
// #endregion

/**
 * A registered extension entry — the value produced by `use()`.\
 * Stored in `Extension.extensions` and in the root registration array
 * passed to `setupTagikon`.
 *
 * Per-extension auxiliary generics are erased here because the parent's
 * view of a child only needs its custom API shape.
 */
export interface ExtensionRegistration<
	TNamespace extends symbol = never,
	TApi extends ApiShape = {},
> {
	readonly extension: Extension<Tag, TNamespace, TApi>;
	readonly namespace: null | TNamespace;
	readonly permissions: ReadonlySet<Permission>;
}

//#region Children API derivation (utility for callers)
/**
 * @internal
 */
type UnionToIntersection<TUnion> = (TUnion extends unknown ? (x: TUnion) => void : never) extends (
	x: infer TIntersect,
) => void
	? TIntersect
	: never;

/**
 * @internal
 */
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

//#region Migration types

/**
 * Context passed to each migration step's `migrate()` function.
 *
 * - `aux` exposes the extension's raw AuxStore without codec decoding, so the
 *   migrator can read data written by the previous schema version.
 * - `tags` provides read/write access to the full tag set for migrations that
 *   need to change tag fields directly.
 *
 * @typeParam TTag - The tag type for this Tagikon instance.
 */
export interface ExtensionMigrationContext<TTag extends Tag> {
	/** Raw AuxStore for this extension — codec is bypassed (`TData = unknown`). */
	readonly aux: AuxStore<IdOf<TTag>, unknown>;
	readonly tags: {
		/** Returns every tag currently in storage. */
		listAll(): Promise<TTag[]>;
		/**
		 * Patches a tag's non-id fields.
		 *
		 * @throws {@link TagNotFoundError} if no tag with `id` exists.
		 */
		update(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	};
}

/**
 * A single forward-only migration step.
 * Steps are applied in ascending `toVersion` order; each must be consecutive
 * starting from 1 (no gaps, no duplicates).
 *
 * @typeParam TTag - The tag type for this Tagikon instance.
 */
export interface ExtensionMigration<TTag extends Tag> {
	/**
	 * The version number this step achieves.
	 * Must be consecutive starting from 1 — validated by {@link migrateTagikon}.
	 */
	readonly toVersion: number;
	readonly migrate: (ctx: ExtensionMigrationContext<TTag>) => Promise<void>;
}

/**
 * Migration manifest attached to an {@link Extension}.
 * Declare this when the shape of your extension's AuxStore data (or tag
 * fields) changes between published versions.
 *
 * @typeParam TTag - The tag type for this Tagikon instance.
 */
export interface ExtensionMigrationManifest<TTag extends Tag> {
	/**
	 * Stable cross-process identifier for this extension.
	 * Use your npm package name (e.g. `"@tagikon/extension-hierarchy"`).
	 * **Never change this value** after deployment — it is the persistence key
	 * used to track which migration steps have already been applied.
	 */
	readonly stableId: string;
	/**
	 * Migration steps in ascending `toVersion` order (1, 2, 3, …).
	 * {@link migrateTagikon} validates that the sequence is contiguous before
	 * running any step.
	 */
	readonly steps: readonly ExtensionMigration<TTag>[];
}

// #endregion

//#region Extension interface
/**
 * The pluggable unit that observes and modifies tag operations.\
 * Build one with {@link createExtension} and register it via {@link use}.
 *
 * An extension can:
 *
 * - **Observe / mutate operations** through `hooks` (see {@link HookPhases}).
 * - **Expose custom methods** through `api`, optionally namespaced via
 *   the `namespace` symbol.
 * - **Compose other extensions** as children through `extensions`.
 *
 * @typeParam TTag - The tag type the extension operates on.
 * @typeParam TNamespace - Unique symbol used to expose `api` on the parent
 *   (or on the root Tagikon object). `never` means no public API.
 * @typeParam TApi - Shape of the custom API exposed under `namespace`.
 * @typeParam TAux - Type of the per-extension auxiliary data (`ctx.aux`).
 * @typeParam TChildrenApi - Map of `{ [childNamespace]: childApiShape }`,
 *   used to type `ctx.api` for children. Use {@link ChildrenApiOf} to
 *   compute this from a children array automatically.
 */
export interface Extension<
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = {},
	TAux = unknown,
	TChildrenApi extends ApiShape = {},
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
	/**
	 * Optional codec for the extension's auxiliary data store (`ctx.aux`).
	 * When provided, the adapter uses it to serialize/deserialize TAux instead of
	 * the default JSON behavior. Required when TAux contains non-JSON-serializable
	 * values such as `bigint` or custom class instances.
	 */
	auxCodec?: AuxCodec<TAux>;
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
		findObjects?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			FindObjectsInput<TTag>,
			ObjectKey[]
		>;
		countObjects?: HookPhases<
			ExtensionContext<TTag, TAux, TChildrenApi>,
			CountObjectsInput<TTag>,
			number
		>;
	};
	api?: ApiImplementation<ExtensionContext<TTag, TAux, TChildrenApi>, TApi>;
	/**
	 * Optional migration manifest for upgrading this extension's persisted
	 * data (AuxStore entries or tag fields) across versions.
	 *
	 * **Requires `namespace`** — the namespace symbol is used as the AuxStore
	 * identity key in both {@link migrateTagikon} and {@link setupTagikon},
	 * so a stable symbol is required for the migration context to address the
	 * correct store. Declaring `migration` without `namespace` will cause
	 * {@link migrateTagikon} to throw {@link InvalidExtensionMigrationError}.
	 */
	migration?: ExtensionMigrationManifest<TTag>;
}
// #endregion
