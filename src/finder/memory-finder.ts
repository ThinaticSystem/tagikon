import type { ObjectKey, TagId } from "../core/ids.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { FinderImplement } from "../plugin/types.ts";
import type { StorageAdapter } from "../storage/adapter.ts";
import type { TagCondition } from "./condition.ts";

const evalCondition = async <TTag extends Tag>(
	condition: TagCondition<IdOf<TTag>>,
	storage: StorageAdapter<TTag>,
): Promise<ObjectKey[]> => {
	switch (condition.type) {
		case "has":
			return storage.listTagObjects(condition.tagId);

		case "and": {
			const resultArrays = await Promise.all(
				condition.conditions.map((condition) => evalCondition(condition, storage)),
			);
			const [firstBatch, ...restBatches] = resultArrays;
			let acc = firstBatch ?? [];
			for (const batch of restBatches) {
				const batchSet = new Set(batch as string[]);
				acc = acc.filter((objectKey) => batchSet.has(objectKey as string));
			}
			return acc;
		}

		case "or": {
			const resultArrays = await Promise.all(
				condition.conditions.map((condition) => evalCondition(condition, storage)),
			);
			const seen = new Set<string>();
			const out: ObjectKey[] = [];
			for (const batch of resultArrays) {
				for (const objectKey of batch) {
					const str = objectKey as string;
					if (!seen.has(str)) {
						seen.add(str);
						out.push(objectKey);
					}
				}
			}
			return out;
		}

		case "not": {
			const [innerResults, allTags] = await Promise.all([
				evalCondition(condition.condition, storage),
				storage.listTags(),
			]);
			const excludeSet = new Set(innerResults);
			const allObjectBatches = await Promise.all(
				allTags.map((tag) => storage.listTagObjects(tag.id as IdOf<TTag>)),
			);
			const allSeen = new Set<string>();
			const allObjects: ObjectKey[] = [];
			for (const batch of allObjectBatches) {
				for (const objectKey of batch) {
					const str = objectKey as string;
					if (!allSeen.has(str)) {
						allSeen.add(str);
						allObjects.push(objectKey);
					}
				}
			}
			return allObjects.filter((objectKey) => !excludeSet.has(objectKey));
		}
	}
};

export class MemoryFinder<TTag extends Tag = Tag<TagId>> implements FinderImplement<TTag> {
	async findObjectsByTags(
		query: TagCondition<IdOf<TTag>>,
		storage: StorageAdapter<TTag>,
	): Promise<ObjectKey[]> {
		return evalCondition(query, storage);
	}
}
