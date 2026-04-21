import type { ObjectKey, TagId } from "../core/ids.ts";
import type { IdOf, KindOf, Tag } from "../core/tag.ts";
import type { TaginkonPlugin } from "../plugin/types.ts";
import type { StorageAdapter } from "../storage/adapter.ts";

import { TagNotFoundError } from "../core/errors.ts";
import { TAG_KIND } from "../core/tag-kind.ts";
import { collectHooks, runPipeline } from "../hook/runner.ts";

export interface Server<TTag extends Tag> {
	addTag(name: string, options?: Partial<Omit<TTag, "id" | "name">>): Promise<TTag>;
	listTags(): Promise<TTag[]>;
	editTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	removeTag(id: IdOf<TTag>): Promise<void>;
	tagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	untagObjects(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	resetWithTags(objectKey: ObjectKey, tagIds: readonly IdOf<TTag>[]): Promise<void>;
	findObjectsByTags(query: unknown): Promise<ObjectKey[]>;
}

export interface ServerOptions<TTag extends Tag> {
	storage: StorageAdapter<TTag>;
	plugins?: TaginkonPlugin<TTag>[];
}

export function createServer<TTag extends Tag>(options: ServerOptions<TTag>): Server<TTag> {
	const { storage, plugins = [] } = options;

	const addTagHooks = collectHooks(plugins.map((p) => p.addTag));
	const listTagsHooks = collectHooks(plugins.map((p) => p.listTags));
	const editTagHooks = collectHooks(plugins.map((p) => p.editTag));
	const removeTagHooks = collectHooks(plugins.map((p) => p.removeTag));
	const tagObjectsHooks = collectHooks(plugins.map((p) => p.tagObjects));
	const untagObjectsHooks = collectHooks(plugins.map((p) => p.untagObjects));
	const resetWithTagsHooks = collectHooks(plugins.map((p) => p.resetWithTags));
	const findObjectsByTagsHooks = collectHooks(plugins.map((p) => p.findObjectsByTags));

	const finder = plugins.find((p) => p.finder)?.finder;

	return {
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

		async removeTag(id) {
			const rawInput = { id };
			await runPipeline(removeTagHooks, rawInput, async ({ id }) => {
				const deleted = await storage.deleteTag(id);
				if (!deleted) {
					throw new TagNotFoundError(id as unknown as TagId);
				}
			});
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
}
