import type { ObjectKey } from "./core/ids.ts";
import type { IdOf, Tag } from "./core/tag.ts";
import type { HookEntry } from "./hook/runner.ts";
import type { ExtensionStorageView } from "./plugin/extension/context.ts";
import type {
	ApiShape,
	ChildrenApiOf,
	Extension,
	ExtensionRegistration,
} from "./plugin/extension/types.ts";
import type { TagFromShape, TagShape } from "./plugin/storage-adapter/codec.ts";
import type { StorageAdapter, StorageAdapterSetup } from "./plugin/storage-adapter/types.ts";
import type { FindObjectsOptions, ObjectQuery } from "./query/types.ts";
import type { Permission } from "./security/permission.ts";

import { RequiredPropertyMissingError } from "./core/errors.ts";
import { collectHooks, runPipeline } from "./hook/runner.ts";
import { createExtensionContext } from "./plugin/extension/context.ts";
import { PermissionDeniedError } from "./security/permission.ts";

/**
 * The set of operations exposed on the object returned by {@link setupTagikon}.\
 * Extensions registered at the root are exposed alongside this surface
 * under their declared namespace symbol.
 *
 * @typeParam TTag - The concrete tag type, derived from the shape passed
 *   to {@link setupTagikon}.
 */
export interface CoreApi<TTag extends Tag> {
	/**
	 * Creates a tag. The `id` is supplied by the configured `IdProvider` —\
	 * pass every other shape property here. Extensions can supply or
	 * override values via transform hooks before persistence.
	 *
	 * @throws {@link RequiredPropertyMissingError} if a required property
	 *   is still absent after the transform-hook phase.
	 *
	 * @example
	 * ```ts
	 * const urgent = await tagikon.addTag({ name: "urgent" });
	 * ```
	 */
	addTag(attributes: Omit<TTag, "id">): Promise<TTag>;

	/**
	 * Returns every tag in storage as a flat list.\
	 * Hierarchical structure is not exposed by core — use
	 * `extension-hierarchy` for tree traversal.
	 */
	listTags(): Promise<TTag[]>;

	/**
	 * Patches a tag in place.
	 *
	 * @throws {@link TagNotFoundError} if no tag with `id` exists.
	 */
	editTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;

	/**
	 * Deletes a tag.
	 *
	 * @returns `true` if a tag was deleted, `false` if no tag with `id`
	 *   existed (no-op).
	 */
	deleteTag(id: IdOf<TTag>): Promise<boolean>;

	/**
	 * Attaches `tagId` to multiple objects at once.\
	 * Idempotent — relations that already exist are left as-is.
	 *
	 * @throws {@link TagNotFoundError} if no tag with `tagId` exists.
	 */
	tagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;

	/**
	 * Removes `tagId` from multiple objects at once.\
	 * Missing relations are silently ignored.
	 */
	untagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;

	/**
	 * Replaces the full set of tags on `objectKey` with `tagIds`.\
	 * The diff against the current set is computed automatically:
	 * tags not in `tagIds` are removed, tags not currently attached are added.
	 */
	resetWithTags(objectKey: ObjectKey, tagIds: readonly IdOf<TTag>[]): Promise<void>;

	/**
	 * Finds object keys matching `query`. Results are sorted lexicographically
	 * so that `limit`/`offset` pagination is deterministic.
	 *
	 * @param options - `limit` caps the number of results; `offset` skips that
	 *   many results before returning. Both default to no-limit / no-skip.
	 *
	 * @example All objects with either tag
	 * ```ts
	 * const keys = await tagikon.findObjects(taggedWithAny(tagsById([a, b])));
	 * ```
	 *
	 * @example Pagination
	 * ```ts
	 * const page2 = await tagikon.findObjects(query, { limit: 50, offset: 50 });
	 * ```
	 */
	findObjects(query: ObjectQuery<IdOf<TTag>>, options?: FindObjectsOptions): Promise<ObjectKey[]>;

	/**
	 * Counts object keys matching `query`. Equivalent to the cardinality of
	 * {@link CoreApi.findObjects} without `limit`/`offset` but typically much
	 * cheaper because adapters can compile it to a `COUNT(*)`.
	 */
	countObjects(query: ObjectQuery<IdOf<TTag>>): Promise<number>;
}

// Internal constraint for tagShape.id — avoids importing IdProvider.
// 'any' in serialize is required: concrete IdProvider<X> is contravariant in X,
// so (id: Uuid)=>string is NOT assignable to (id: unknown)=>string.
type AnyIdProvider = {
	readonly generate: () => unknown;
	readonly serialize: (id: any) => string;
	readonly deserialize: (raw: string) => unknown;
};
type AnyTagShape = { readonly id: AnyIdProvider } & Record<string, unknown>;

export interface SetupTagikonOptions<
	TShape extends AnyTagShape,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
> {
	tagShape: TShape;
	/**
	 * Either a pre-initialization storage adapter setup (which `setupTagikon`
	 * will initialize), or an already-initialized {@link StorageAdapter}
	 * returned by {@link migrateTagikon}. The latter avoids a second
	 * `initialize()` call when migrations are run before setup.
	 */
	storageAdapter: StorageAdapterSetup<TagFromShape<TShape>> | StorageAdapter<TagFromShape<TShape>>;
	/**
	 * Extensions registered at the root. Each entry is exposed on the returned
	 * Tagikon object under its namespace symbol; their descendants stay private.
	 */
	extensions?: TRegistrations;
}

const wrapStorageForExtensions = <TTag extends Tag>(
	storage: StorageAdapter<TTag>,
): ExtensionStorageView<TTag> => ({
	createTag: storage.createTag.bind(storage),
	getTag: storage.getTag.bind(storage),
	listTags: storage.listTags.bind(storage),
	updateTag: storage.updateTag.bind(storage),
	deleteTag: storage.deleteTag.bind(storage),
	addRelations: storage.addRelations.bind(storage),
	removeRelations: storage.removeRelations.bind(storage),
	listObjectTags: storage.listObjectTags.bind(storage),
	listTagObjects: storage.listTagObjects.bind(storage),
	findObjects: storage.findObjects.bind(storage),
	countObjects: storage.countObjects.bind(storage),
});

const createPermissionGuardedView = <TTag extends Tag>(
	view: ExtensionStorageView<TTag>,
	permissions: ReadonlySet<Permission>,
): ExtensionStorageView<TTag> => {
	const denied = (permission: Permission): never => {
		throw new PermissionDeniedError(permission);
	};
	const tagRead = permissions.has("tag:read");
	const tagWrite = permissions.has("tag:write");
	const relRead = permissions.has("relation:read");
	const relWrite = permissions.has("relation:write");
	return Object.freeze({
		createTag: tagWrite ? view.createTag : () => denied("tag:write"),
		getTag: tagRead ? view.getTag : () => denied("tag:read"),
		listTags: tagRead ? view.listTags : () => denied("tag:read"),
		updateTag: tagWrite ? view.updateTag : () => denied("tag:write"),
		deleteTag: tagWrite ? view.deleteTag : () => denied("tag:write"),
		addRelations: relWrite ? view.addRelations : () => denied("relation:write"),
		removeRelations: relWrite ? view.removeRelations : () => denied("relation:write"),
		listObjectTags: relRead ? view.listObjectTags : () => denied("relation:read"),
		listTagObjects: relRead ? view.listTagObjects : () => denied("relation:read"),
		findObjects: relRead ? view.findObjects : () => denied("relation:read"),
		countObjects: relRead ? view.countObjects : () => denied("relation:read"),
	}) as unknown as ExtensionStorageView<TTag>;
};

type AnyExtension<TTag extends Tag> = Extension<TTag, symbol, ApiShape>;
type BoundApi = Record<string, (...args: readonly unknown[]) => unknown>;
type AnyHookEntry = HookEntry<unknown, unknown, unknown>;

interface OperationHookEntries {
	addTag: AnyHookEntry[];
	listTags: AnyHookEntry[];
	editTag: AnyHookEntry[];
	removeTag: AnyHookEntry[];
	tagObjects: AnyHookEntry[];
	untagObjects: AnyHookEntry[];
	resetWithTags: AnyHookEntry[];
	findObjects: AnyHookEntry[];
	countObjects: AnyHookEntry[];
}

const operationKeys = [
	"addTag",
	"listTags",
	"editTag",
	"removeTag",
	"tagObjects",
	"untagObjects",
	"resetWithTags",
	"findObjects",
	"countObjects",
] as const satisfies readonly (keyof OperationHookEntries)[];

const emptyHookEntries = (): OperationHookEntries => ({
	addTag: [],
	listTags: [],
	editTag: [],
	removeTag: [],
	tagObjects: [],
	untagObjects: [],
	resetWithTags: [],
	findObjects: [],
	countObjects: [],
});

interface ExtensionBinding {
	readonly boundApi: BoundApi;
}

/**
 * Creates a Tagikon instance from a tag shape, storage adapter, and a set
 * of root-level extensions. The returned object exposes {@link CoreApi}
 * plus each root extension's API under its declared namespace symbol.
 *
 * The tag shape's `id` field must be an {@link IdProvider}; every other
 * field is a {@link TagPropertyCodec} (use {@link tpc} for built-ins).\
 * The concrete tag type is inferred from the shape — no explicit type
 * argument is needed in most cases.
 *
 * @example Minimal setup
 * ```ts
 * import { setupTagikon, tpc } from "@tagikon/core";
 * import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
 * import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
 *
 * const tagikon = setupTagikon({
 *   tagShape: { id: UUID_ID_PROVIDER, name: tpc.string() },
 *   storageAdapter: new MapStorageAdapter(),
 * });
 * ```
 *
 * @example With extensions
 * ```ts
 * import { use } from "@tagikon/core";
 * import { createHierarchy, HIERARCHY_NS } from "@tagikon/extension-hierarchy";
 *
 * const tagikon = setupTagikon({
 *   tagShape,
 *   storageAdapter,
 *   extensions: [use(createHierarchy(), { permissions: ["tag:read", "tag:write"] })],
 * });
 *
 * await tagikon[HIERARCHY_NS].moveTag(child, parent);
 * ```
 */
export const setupTagikon = <
	TShape extends AnyTagShape,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
>(
	options: SetupTagikonOptions<TShape, TRegistrations>,
): CoreApi<TagFromShape<TShape>> & ChildrenApiOf<TRegistrations> => {
	const {
		tagShape,
		storageAdapter,
		extensions: rootRegistrations = [] as unknown as TRegistrations,
	} = options;

	const initializedAdapter: StorageAdapter<TagFromShape<TShape>> =
		"initialize" in storageAdapter
			? storageAdapter.initialize(tagShape as unknown as TagShape<TagFromShape<TShape>>)
			: storageAdapter;

	// Build the set of required (non-optional) property names from the shape for runtime validation.
	const requiredProperties = new Set(
		Object.entries(tagShape)
			.values()
			.filter(
				([key, entry]) =>
					!(typeof entry === "object" && entry !== null && "_optional" in entry) && key !== "id",
			)
			.map(([key]) => key),
	);

	const storageView = wrapStorageForExtensions(initializedAdapter);

	let anonymousSequence = 0;
	const allocateSymbolFor = (ext: AnyExtension<TagFromShape<TShape>>): symbol =>
		ext.namespace ?? Symbol(`$anonymous-extension-${anonymousSequence++}`);

	const allHookEntries = emptyHookEntries();

	const buildBinding = (
		ext: AnyExtension<TagFromShape<TShape>>,
		permissions: ReadonlySet<Permission>,
	): ExtensionBinding => {
		const childrenBoundApiMap: Record<symbol, BoundApi> = {};

		for (const childRegistration of ext.extensions ?? []) {
			const childExtension = childRegistration.extension as unknown as AnyExtension<
				TagFromShape<TShape>
			>;
			const childBinding = buildBinding(childExtension, childRegistration.permissions);
			if (childRegistration.namespace) {
				childrenBoundApiMap[childRegistration.namespace] = childBinding.boundApi;
			}
		}

		const extensionSymbol = allocateSymbolFor(ext);
		const aux = initializedAdapter.getAuxStore(
			extensionSymbol,
			ext.auxCodec as Parameters<typeof initializedAdapter.getAuxStore>[1],
		);
		const guardedView = createPermissionGuardedView(storageView, permissions);
		const ctx = createExtensionContext<TagFromShape<TShape>, unknown, Record<symbol, BoundApi>>(
			guardedView,
			aux,
			childrenBoundApiMap,
		);

		const boundApi: BoundApi = {};
		if (ext.api) {
			const apiImpls = ext.api as unknown as Record<
				string,
				(ctx: unknown, ...args: readonly unknown[]) => unknown
			>;
			for (const key of Object.keys(apiImpls)) {
				const method = apiImpls[key];
				if (method) boundApi[key] = (...args) => method(ctx, ...args);
			}
		}

		for (const operation of operationKeys) {
			const phases = ext.hooks?.[operation];
			if (phases) {
				allHookEntries[operation].push({
					ctx: ctx as unknown,
					phases: phases as unknown,
				} as HookEntry<unknown, unknown, unknown>);
			}
		}

		return { boundApi };
	};

	const namespacedApis: Record<symbol, BoundApi> = {};
	for (const childRegistration of rootRegistrations) {
		const childExtension = childRegistration.extension as unknown as AnyExtension<
			TagFromShape<TShape>
		>;
		const childBinding = buildBinding(childExtension, childRegistration.permissions);
		if (childRegistration.namespace) {
			namespacedApis[childRegistration.namespace] = childBinding.boundApi;
		}
	}

	const addTagHooks = collectHooks(allHookEntries.addTag);
	const listTagsHooks = collectHooks(allHookEntries.listTags);
	const editTagHooks = collectHooks(allHookEntries.editTag);
	const removeTagHooks = collectHooks(allHookEntries.removeTag);
	const tagObjectsHooks = collectHooks(allHookEntries.tagObjects);
	const untagObjectsHooks = collectHooks(allHookEntries.untagObjects);
	const resetWithTagsHooks = collectHooks(allHookEntries.resetWithTags);
	const findObjectsHooks = collectHooks(allHookEntries.findObjects);
	const countObjectsHooks = collectHooks(allHookEntries.countObjects);

	type TTag = TagFromShape<TShape>;

	const coreApi: CoreApi<TTag> = {
		async addTag(attributes) {
			return runPipeline(addTagHooks, attributes, (data) => {
				// Validate after all transform hooks so extensions (e.g. default-attributes) can fill in
				// required properties before this check fires.
				const attrs = data as Record<string, unknown>;
				for (const prop of requiredProperties) {
					if (!(prop in attrs)) throw new RequiredPropertyMissingError(prop);
				}
				return initializedAdapter.createTag(data as Omit<TTag, "id">);
			}) as Promise<TTag>;
		},
		async listTags() {
			return runPipeline(listTagsHooks, {}, () => initializedAdapter.listTags()) as Promise<TTag[]>;
		},
		async editTag(id, patch) {
			return runPipeline(editTagHooks, { id, patch }, (input) => {
				const typed = input as { id: IdOf<TTag>; patch: Partial<Omit<TTag, "id">> };
				return initializedAdapter.updateTag(typed.id, typed.patch);
			}) as Promise<TTag>;
		},
		async deleteTag(id) {
			return runPipeline(removeTagHooks, { id }, (input) =>
				initializedAdapter.deleteTag((input as { id: IdOf<TTag> }).id),
			) as Promise<boolean>;
		},
		async tagObjects(tagId, objectKeys) {
			await runPipeline(tagObjectsHooks, { tagId, objectKeys }, (input) => {
				const typed = input as {
					tagId: IdOf<TTag>;
					objectKeys: readonly ObjectKey[];
				};
				return initializedAdapter.addRelations(typed.tagId, typed.objectKeys);
			});
		},
		async untagObjects(tagId, objectKeys) {
			await runPipeline(untagObjectsHooks, { tagId, objectKeys }, (input) => {
				const typed = input as {
					tagId: IdOf<TTag>;
					objectKeys: readonly ObjectKey[];
				};
				return initializedAdapter.removeRelations(typed.tagId, typed.objectKeys);
			});
		},
		async resetWithTags(objectKey, tagIds) {
			await runPipeline(resetWithTagsHooks, { objectKey, tagIds }, async (input) => {
				const typed = input as {
					objectKey: ObjectKey;
					tagIds: readonly IdOf<TTag>[];
				};
				const currentIds = await initializedAdapter.listObjectTags(typed.objectKey);
				const newSet = new Set<IdOf<TTag>>(typed.tagIds);
				const currentSet = new Set<IdOf<TTag>>(currentIds);
				const toAdd = typed.tagIds.values().filter((id) => !currentSet.has(id));
				const toRemove = currentIds.values().filter((id) => !newSet.has(id));
				for (const tid of toAdd) await initializedAdapter.addRelations(tid, [typed.objectKey]);
				for (const tid of toRemove)
					await initializedAdapter.removeRelations(tid, [typed.objectKey]);
			});
		},
		async findObjects(query, options) {
			return runPipeline(findObjectsHooks, { query, options }, (input) => {
				const typed = input as {
					query: ObjectQuery<IdOf<TTag>>;
					options: FindObjectsOptions | undefined;
				};
				return initializedAdapter.findObjects(typed.query, typed.options);
			}) as Promise<ObjectKey[]>;
		},
		async countObjects(query) {
			return runPipeline(countObjectsHooks, { query }, (input) => {
				const typed = input as { query: ObjectQuery<IdOf<TTag>> };
				return initializedAdapter.countObjects(typed.query);
			}) as Promise<number>;
		},
	};

	return Object.assign(coreApi, namespacedApis) as CoreApi<TTag> & ChildrenApiOf<TRegistrations>;
};
