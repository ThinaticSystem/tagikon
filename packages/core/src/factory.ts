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
import type { StorageAdapter } from "./plugin/storage-adapter/types.ts";
import type { FindObjectsOptions, ObjectQuery } from "./query/types.ts";
import type { Permission } from "./security/permission.ts";

import { RequiredPropertyMissingError } from "./core/errors.ts";
import { collectHooks, runPipeline } from "./hook/runner.ts";
import { createExtensionContext } from "./plugin/extension/context.ts";
import { PermissionDeniedError } from "./security/permission.ts";

export interface CoreApi<TTag extends Tag> {
	addTag(attributes: Omit<TTag, "id">): Promise<TTag>;
	listTags(): Promise<TTag[]>;
	editTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	deleteTag(id: IdOf<TTag>): Promise<boolean>;
	tagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	untagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	resetWithTags(objectKey: ObjectKey, tagIds: readonly IdOf<TTag>[]): Promise<void>;
	findObjects(query: ObjectQuery<IdOf<TTag>>, options?: FindObjectsOptions): Promise<ObjectKey[]>;
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
	storageAdapter: StorageAdapter<TagFromShape<TShape>>;
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

	storageAdapter.setIdProvider(tagShape.id as Parameters<typeof storageAdapter.setIdProvider>[0]);
	storageAdapter.setTagCodec?.(tagShape as unknown as TagShape<TagFromShape<TShape>>);

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

	const storageView = wrapStorageForExtensions(storageAdapter);

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
		const aux = storageAdapter.getAuxStore(
			extensionSymbol,
			ext.auxCodec as Parameters<typeof storageAdapter.getAuxStore>[1],
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
				return storageAdapter.createTag(data as Omit<TTag, "id">);
			}) as Promise<TTag>;
		},
		async listTags() {
			return runPipeline(listTagsHooks, {}, () => storageAdapter.listTags()) as Promise<TTag[]>;
		},
		async editTag(id, patch) {
			return runPipeline(editTagHooks, { id, patch }, (input) => {
				const typed = input as { id: IdOf<TTag>; patch: Partial<Omit<TTag, "id">> };
				return storageAdapter.updateTag(typed.id, typed.patch);
			}) as Promise<TTag>;
		},
		async deleteTag(id) {
			return runPipeline(removeTagHooks, { id }, (input) =>
				storageAdapter.deleteTag((input as { id: IdOf<TTag> }).id),
			) as Promise<boolean>;
		},
		async tagObjects(tagId, objectKeys) {
			await runPipeline(tagObjectsHooks, { tagId, objectKeys }, (input) => {
				const typed = input as {
					tagId: IdOf<TTag>;
					objectKeys: readonly ObjectKey[];
				};
				return storageAdapter.addRelations(typed.tagId, typed.objectKeys);
			});
		},
		async untagObjects(tagId, objectKeys) {
			await runPipeline(untagObjectsHooks, { tagId, objectKeys }, (input) => {
				const typed = input as {
					tagId: IdOf<TTag>;
					objectKeys: readonly ObjectKey[];
				};
				return storageAdapter.removeRelations(typed.tagId, typed.objectKeys);
			});
		},
		async resetWithTags(objectKey, tagIds) {
			await runPipeline(resetWithTagsHooks, { objectKey, tagIds }, async (input) => {
				const typed = input as {
					objectKey: ObjectKey;
					tagIds: readonly IdOf<TTag>[];
				};
				const currentIds = await storageAdapter.listObjectTags(typed.objectKey);
				const newSet = new Set<IdOf<TTag>>(typed.tagIds);
				const currentSet = new Set<IdOf<TTag>>(currentIds);
				const toAdd = typed.tagIds.values().filter((id) => !currentSet.has(id));
				const toRemove = currentIds.values().filter((id) => !newSet.has(id));
				for (const tid of toAdd) await storageAdapter.addRelations(tid, [typed.objectKey]);
				for (const tid of toRemove) await storageAdapter.removeRelations(tid, [typed.objectKey]);
			});
		},
		async findObjects(query, options) {
			return runPipeline(findObjectsHooks, { query, options }, (input) => {
				const typed = input as {
					query: ObjectQuery<IdOf<TTag>>;
					options: FindObjectsOptions | undefined;
				};
				return storageAdapter.findObjects(typed.query, typed.options);
			}) as Promise<ObjectKey[]>;
		},
		async countObjects(query) {
			return runPipeline(countObjectsHooks, { query }, (input) => {
				const typed = input as { query: ObjectQuery<IdOf<TTag>> };
				return storageAdapter.countObjects(typed.query);
			}) as Promise<number>;
		},
	};

	return Object.assign(coreApi, namespacedApis) as CoreApi<TTag> & ChildrenApiOf<TRegistrations>;
};
