import type { ObjectKey } from "../core/ids.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { TagCondition } from "../finder/condition.ts";
import type { ExtensionContext } from "../plugin/extension/context.ts";
import type { ApiShape, Extension } from "../plugin/extension/types.ts";
import type { ExtensionRegistration } from "../plugin/extension/use.ts";
import type { StorageAdapter } from "../plugin/storage-adapter/types.ts";

import { collectHooks, runPipeline } from "../hook/runner.ts";
import { createExtensionContext } from "../plugin/extension/context.ts";

//#region Type-level API merging
type UnionToIntersection<TUnion> = (TUnion extends unknown ? (x: TUnion) => void : never) extends (
	x: infer TIntersect,
) => void
	? TIntersect
	: never;

type ApiOf<TRegistration> =
	TRegistration extends ExtensionRegistration<infer TNamespace, infer TApi>
		? { readonly [TKey in TNamespace]: TApi }
		: Record<never, never>;

type MergeApis<TRegistrations extends readonly unknown[]> = UnionToIntersection<
	ApiOf<TRegistrations[number]>
>;
// #endregion

// TODO: `CoreApi` に改名
export interface Server<TTag extends Tag> {
	addTag(attributes: Omit<TTag, "id">): Promise<TTag>;
	listTags(): Promise<TTag[]>;
	editTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	deleteTag(id: IdOf<TTag>): Promise<boolean>;
	tagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	untagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	resetWithTags(objectKey: ObjectKey, tagIds: readonly IdOf<TTag>[]): Promise<void>;
	findObjectsByTags(query: TagCondition<IdOf<TTag>>): Promise<ObjectKey[]>;
}

export interface ServerOptions<
	TTag extends Tag,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
> {
	storage: StorageAdapter<TTag>;
	extensions?: TRegistrations;
}

// TODO: `setupTagikon` に改名
export const createServer = <
	TTag extends Tag,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
>(
	options: ServerOptions<TTag, TRegistrations>,
): Server<TTag> & MergeApis<TRegistrations> => {
	const { storage, extensions: registrations = [] as unknown as TRegistrations } = options;

	// Cast to TTag: use() verified compatibility at the call site
	const extensions = registrations.map(
		(r) => r.extension as unknown as Extension<TTag, symbol, ApiShape>,
	);

	const addTagHooks = collectHooks(extensions.map((p) => p.hooks?.addTag));
	const listTagsHooks = collectHooks(extensions.map((p) => p.hooks?.listTags));
	const editTagHooks = collectHooks(extensions.map((p) => p.hooks?.editTag));
	const removeTagHooks = collectHooks(extensions.map((p) => p.hooks?.removeTag));
	const tagObjectsHooks = collectHooks(extensions.map((p) => p.hooks?.tagObjects));
	const untagObjectsHooks = collectHooks(extensions.map((p) => p.hooks?.untagObjects));
	const resetWithTagsHooks = collectHooks(extensions.map((p) => p.hooks?.resetWithTags));
	const findObjectsByTagsHooks = collectHooks(extensions.map((p) => p.hooks?.findObjectsByTags));

	const finder = extensions.find((p) => p.finder)?.finder;

	const server: Server<TTag> = {
		async addTag(attributes) {
			return runPipeline(addTagHooks, attributes, (data) => storage.createTag(data));
		},

		async listTags() {
			return runPipeline(listTagsHooks, {}, () => storage.listTags());
		},

		async editTag(id, patch) {
			const rawInput = { id, patch };
			return runPipeline(editTagHooks, rawInput, ({ id, patch }) => storage.updateTag(id, patch));
		},

		async deleteTag(id) {
			const rawInput = { id };
			return runPipeline(removeTagHooks, rawInput, ({ id }) => storage.deleteTag(id));
		},

		async tagObjects(tagId, objectKeys) {
			const rawInput = { tagId, objectKeys };
			await runPipeline(tagObjectsHooks, rawInput, ({ tagId, objectKeys }) =>
				storage.addRelations(tagId, objectKeys),
			);
		},

		async untagObjects(tagId, objectKeys) {
			const rawInput = { tagId, objectKeys };
			await runPipeline(untagObjectsHooks, rawInput, ({ tagId, objectKeys }) =>
				storage.removeRelations(tagId, objectKeys),
			);
		},

		async resetWithTags(objectKey, tagIds) {
			const rawInput = { objectKey, tagIds };
			await runPipeline(resetWithTagsHooks, rawInput, async ({ objectKey, tagIds }) => {
				const currentIds = await storage.listObjectTags(objectKey);
				const newTagIdSet = new Set<IdOf<TTag>>(tagIds);
				const currentTagIdSet = new Set<IdOf<TTag>>(currentIds);

				const toAdd = tagIds.filter((id) => !currentTagIdSet.has(id));
				const toRemove = currentIds.filter((id) => !newTagIdSet.has(id));

				for (const tid of toAdd) {
					await storage.addRelations(tid, [objectKey]);
				}
				for (const tid of toRemove) {
					await storage.removeRelations(tid, [objectKey]);
				}
			});
		},

		async findObjectsByTags(query) {
			const rawInput = { query };
			return runPipeline(findObjectsByTagsHooks, rawInput, ({ query }) => {
				if (!finder) return Promise.resolve([]);
				return finder.findObjectsByTags(query, storage);
			});
		},
	};

	// Register namespaced APIs
	const namespacedApis: Record<
		symbol,
		Record<string, (...args: readonly unknown[]) => unknown>
	> = {};
	for (const registration of registrations) {
		if (!registration.extension.api || !registration.namespace) continue;

		const ctx = createExtensionContext(storage);
		const api = registration.extension.api as Record<
			string,
			(ctx: ExtensionContext<TTag>, ...args: readonly unknown[]) => unknown
		>;
		const nsApi: Record<string, (...args: readonly unknown[]) => unknown> = {};
		for (const key of Object.keys(api)) {
			const method = api[key];
			if (method) {
				nsApi[key] = (...args) => method(ctx, ...args);
			}
		}
		namespacedApis[registration.namespace] = nsApi;
	}

	return Object.assign(server, namespacedApis) as Server<TTag> & MergeApis<TRegistrations>;
};
