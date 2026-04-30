import type { ObjectKey } from "../core/ids.ts";
import type { IdOf, KindOf, Tag } from "../core/tag.ts";
import type { TagCondition } from "../finder/condition.ts";
import type { PluginContext } from "../plugin/context.ts";
import type { ApiShape, TaginkonPlugin } from "../plugin/types.ts";
import type { PluginRegistration } from "../plugin/use.ts";
import type { StorageAdapter } from "../storage/adapter.ts";

import { TAG_KIND } from "../core/tag-kind.ts";
import { collectHooks, runPipeline } from "../hook/runner.ts";
import { createPluginContext } from "../plugin/context.ts";

//#region Type-level API merging
type UnionToIntersection<TUnion> = (TUnion extends unknown ? (x: TUnion) => void : never) extends (
	x: infer TIntersect,
) => void
	? TIntersect
	: never;

type ApiOf<TRegistration> =
	TRegistration extends PluginRegistration<infer TNamespace, infer TApi>
		? { readonly [TKey in TNamespace]: TApi }
		: Record<never, never>;

type MergeApis<TRegistrations extends readonly unknown[]> = UnionToIntersection<
	ApiOf<TRegistrations[number]>
>;
// #endregion

export interface Server<TTag extends Tag> {
	addTag(name: string, options?: Partial<Omit<TTag, "id" | "name">>): Promise<TTag>;
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
	TRegistrations extends readonly PluginRegistration<symbol, ApiShape>[] = readonly [],
> {
	storage: StorageAdapter<TTag>;
	plugins?: TRegistrations;
}

export const createServer = <
	TTag extends Tag,
	TRegistrations extends readonly PluginRegistration<symbol, ApiShape>[] = readonly [],
>(
	options: ServerOptions<TTag, TRegistrations>,
): Server<TTag> & MergeApis<TRegistrations> => {
	const { storage, plugins: registrations = [] as unknown as TRegistrations } = options;

	// Cast to TTag: use() verified compatibility at the call site
	const plugins = registrations.map(
		(r) => r.plugin as unknown as TaginkonPlugin<TTag, symbol, ApiShape>,
	);

	const addTagHooks = collectHooks(plugins.map((p) => p.addTag));
	const listTagsHooks = collectHooks(plugins.map((p) => p.listTags));
	const editTagHooks = collectHooks(plugins.map((p) => p.editTag));
	const removeTagHooks = collectHooks(plugins.map((p) => p.removeTag));
	const tagObjectsHooks = collectHooks(plugins.map((p) => p.tagObjects));
	const untagObjectsHooks = collectHooks(plugins.map((p) => p.untagObjects));
	const resetWithTagsHooks = collectHooks(plugins.map((p) => p.resetWithTags));
	const findObjectsByTagsHooks = collectHooks(plugins.map((p) => p.findObjectsByTags));

	const finder = plugins.find((p) => p.finder)?.finder;

	const server: Server<TTag> = {
		async addTag(name, opts) {
			const rawInput = {
				name,
				kind: TAG_KIND.USER as KindOf<TTag>,
				...opts,
			} as unknown as Omit<TTag, "id">;
			return runPipeline(addTagHooks, rawInput, (data) => storage.createTag(data));
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

	const namespacedApis: Record<
		symbol,
		Record<string, (...args: readonly unknown[]) => unknown>
	> = {};
	for (const registration of registrations) {
		if (!registration.plugin.api || !registration.namespace) continue;

		const ctx = createPluginContext(storage);
		const api = registration.plugin.api as Record<
			string,
			(ctx: PluginContext<TTag>, ...args: readonly unknown[]) => unknown
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
