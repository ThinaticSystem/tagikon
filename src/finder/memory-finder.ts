import type { ObjectKey, TagId } from "../core/ids.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { FinderImplement } from "../plugin/extension/types.ts";
import type { StorageAdapter } from "../plugin/storage-adapter/types.ts";
import type { TagCondition, TagPropertyCondition } from "./condition.ts";

const evalTagPropertyMatch = (tagValue: unknown, condition: TagPropertyCondition): boolean => {
	switch (condition.match) {
		case "equal":
			return tagValue === condition.value;
		case "contains":
			return typeof tagValue === "string" && tagValue.includes(condition.value);
		case "starts-with":
			return typeof tagValue === "string" && tagValue.startsWith(condition.value);
		case "ends-with":
			return typeof tagValue === "string" && tagValue.endsWith(condition.value);
		case "greater-than":
			return typeof tagValue === "number" && tagValue > condition.value;
		case "less-than":
			return typeof tagValue === "number" && tagValue < condition.value;
		case "greater-than-or-equal":
			return typeof tagValue === "number" && tagValue >= condition.value;
		case "less-than-or-equal":
			return typeof tagValue === "number" && tagValue <= condition.value;
	}
};

const evalCondition = async <TTag extends Tag>(
	condition: TagCondition<IdOf<TTag>>,
	storage: StorageAdapter<TTag>,
): Promise<ObjectKey[]> => {
	switch (condition.type) {
		case "has":
			return storage.listTagObjects(condition.tagId);

		case "tag-property": {
			const allTags = await storage.listTags();
			const matchingTagIds = allTags
				.values()
				.filter((tag) => {
					const tagValue = (tag as unknown as Record<string, unknown>)[condition.property];
					return evalTagPropertyMatch(tagValue, condition);
				})
				.map((tag) => tag.id as IdOf<TTag>);
			const resultArrays = await Promise.all(
				matchingTagIds.map((tagId) => storage.listTagObjects(tagId)),
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

		case "and": {
			const resultArrays = await Promise.all(
				condition.conditions.values().map((condition) => evalCondition(condition, storage)),
			);
			const [firstBatch, ...restBatches] = resultArrays;
			let acc = firstBatch ?? [];
			for (const batch of restBatches) {
				const batchSet = new Set(batch as string[]);
				acc = acc
					.values()
					.filter((objectKey) => batchSet.has(objectKey as string))
					.toArray();
			}
			return acc;
		}

		case "or": {
			const resultArrays = await Promise.all(
				condition.conditions.values().map((condition) => evalCondition(condition, storage)),
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
				allTags.values().map((tag) => storage.listTagObjects(tag.id as IdOf<TTag>)),
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
			return allObjects
				.values()
				.filter((objectKey) => !excludeSet.has(objectKey))
				.toArray();
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
