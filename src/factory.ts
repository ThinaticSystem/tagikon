import type { ObjectKey } from "./core/ids.ts";
import type { IdOf, Tag } from "./core/tag.ts";
import type { TagCondition } from "./finder/condition.ts";
import type { HookEntry } from "./hook/runner.ts";
import type { ExtensionStorageView } from "./plugin/extension/context.ts";
import type {
	ApiShape,
	ChildrenApiOf,
	Extension,
	ExtensionRegistration,
	FinderImplement,
} from "./plugin/extension/types.ts";
import type { StorageAdapter } from "./plugin/storage-adapter/types.ts";

import { collectHooks, runPipeline } from "./hook/runner.ts";
import { createExtensionContext } from "./plugin/extension/context.ts";

export interface CoreApi<TTag extends Tag> {
	addTag(attributes: Omit<TTag, "id">): Promise<TTag>;
	listTags(): Promise<TTag[]>;
	editTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	deleteTag(id: IdOf<TTag>): Promise<boolean>;
	tagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	untagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	resetWithTags(objectKey: ObjectKey, tagIds: readonly IdOf<TTag>[]): Promise<void>;
	findObjectsByTags(query: TagCondition<IdOf<TTag>>): Promise<ObjectKey[]>;
}

export interface SetupTagikonOptions<
	TTag extends Tag,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
> {
	storageAdapter: StorageAdapter<TTag>;
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
});

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
	findObjectsByTags: AnyHookEntry[];
}

const operationKeys = [
	"addTag",
	"listTags",
	"editTag",
	"removeTag",
	"tagObjects",
	"untagObjects",
	"resetWithTags",
	"findObjectsByTags",
] as const satisfies readonly (keyof OperationHookEntries)[];

const emptyHookEntries = (): OperationHookEntries => ({
	addTag: [],
	listTags: [],
	editTag: [],
	removeTag: [],
	tagObjects: [],
	untagObjects: [],
	resetWithTags: [],
	findObjectsByTags: [],
});

interface ExtensionBinding {
	readonly boundApi: BoundApi;
}

export const setupTagikon = <
	TTag extends Tag,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
>(
	options: SetupTagikonOptions<TTag, TRegistrations>,
): CoreApi<TTag> & ChildrenApiOf<TRegistrations> => {
	const { storageAdapter, extensions: rootRegistrations = [] as unknown as TRegistrations } =
		options;
	const storageView = wrapStorageForExtensions(storageAdapter);

	let anonymousSequence = 0;
	const allocateSymbolFor = (ext: AnyExtension<TTag>): symbol =>
		ext.namespace ?? Symbol(`$anonymous-extension-${anonymousSequence++}`);

	const allHookEntries = emptyHookEntries();

	const buildBinding = (ext: AnyExtension<TTag>): ExtensionBinding => {
		const childrenBoundApiMap: Record<symbol, BoundApi> = {};

		for (const childRegistration of ext.extensions ?? []) {
			const childExtension = childRegistration.extension as unknown as AnyExtension<TTag>;
			const childBinding = buildBinding(childExtension);
			if (childRegistration.namespace) {
				childrenBoundApiMap[childRegistration.namespace] = childBinding.boundApi;
			}
		}

		const extensionSymbol = allocateSymbolFor(ext);
		const aux = storageAdapter.getAuxStore<unknown>(extensionSymbol);
		const ctx = createExtensionContext<TTag, unknown, Record<symbol, BoundApi>>(
			storageView,
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
		const childExtension = childRegistration.extension as unknown as AnyExtension<TTag>;
		const childBinding = buildBinding(childExtension);
		if (childRegistration.namespace) {
			namespacedApis[childRegistration.namespace] = childBinding.boundApi;
		}
	}

	const findFinder = (
		registrations: readonly ExtensionRegistration<symbol, ApiShape>[],
	): null | FinderImplement<TTag> => {
		for (const registration of registrations) {
			const ext = registration.extension as unknown as AnyExtension<TTag>;
			if (ext.finder) return ext.finder;
		}
		for (const registration of registrations) {
			const ext = registration.extension as unknown as AnyExtension<TTag>;
			const found = findFinder(ext.extensions ?? []);
			if (found) return found;
		}
		return null;
	};
	const finder = findFinder(rootRegistrations);

	const addTagHooks = collectHooks(allHookEntries.addTag);
	const listTagsHooks = collectHooks(allHookEntries.listTags);
	const editTagHooks = collectHooks(allHookEntries.editTag);
	const removeTagHooks = collectHooks(allHookEntries.removeTag);
	const tagObjectsHooks = collectHooks(allHookEntries.tagObjects);
	const untagObjectsHooks = collectHooks(allHookEntries.untagObjects);
	const resetWithTagsHooks = collectHooks(allHookEntries.resetWithTags);
	const findObjectsByTagsHooks = collectHooks(allHookEntries.findObjectsByTags);

	const coreApi: CoreApi<TTag> = {
		async addTag(attributes) {
			return runPipeline(addTagHooks, attributes, (data) =>
				storageAdapter.createTag(data as Omit<TTag, "id">),
			) as Promise<TTag>;
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
				const toAdd = typed.tagIds.filter((id) => !currentSet.has(id));
				const toRemove = currentIds.filter((id) => !newSet.has(id));
				for (const tid of toAdd) await storageAdapter.addRelations(tid, [typed.objectKey]);
				for (const tid of toRemove) await storageAdapter.removeRelations(tid, [typed.objectKey]);
			});
		},
		async findObjectsByTags(query) {
			return runPipeline(findObjectsByTagsHooks, { query }, (input) => {
				const typed = input as { query: TagCondition<IdOf<TTag>> };
				if (!finder) return Promise.resolve([] as ObjectKey[]);
				return finder.findObjectsByTags(typed.query, storageAdapter);
			}) as Promise<ObjectKey[]>;
		},
	};

	return Object.assign(coreApi, namespacedApis) as CoreApi<TTag> & ChildrenApiOf<TRegistrations>;
};
