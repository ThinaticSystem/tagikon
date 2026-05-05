import type { ObjectKey } from "../core/ids.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type {
	FindObjectsOptions,
	ObjectQuery,
	TagPredicate,
	TagPropertyPredicate,
	TagSelector,
} from "./types.ts";

interface EvaluatorStorage<TTag extends Tag> {
	listTags: () => Promise<TTag[]>;
	listTagObjects: (tagId: IdOf<TTag>) => Promise<ObjectKey[]>;
}

// TODO: Move to a utilities directory
const INITIAL = Symbol("INITIAL");
const memoize = <TValue>(fn: () => TValue): (() => TValue) => {
	let cached: typeof INITIAL | TValue = INITIAL;
	return () => (cached === INITIAL ? (cached = fn()) : cached);
};

const evaluateTagPropertyPredicate = (
	tagValue: unknown,
	predicate: TagPropertyPredicate,
): boolean => {
	switch (predicate.match) {
		case "equal":
			return tagValue === predicate.value;
		case "contains":
			return typeof tagValue === "string" && tagValue.includes(predicate.value);
		case "starts-with":
			return typeof tagValue === "string" && tagValue.startsWith(predicate.value);
		case "ends-with":
			return typeof tagValue === "string" && tagValue.endsWith(predicate.value);
		case "greater-than":
			return typeof tagValue === "number" && tagValue > predicate.value;
		case "less-than":
			return typeof tagValue === "number" && tagValue < predicate.value;
		case "greater-than-or-equal":
			return typeof tagValue === "number" && tagValue >= predicate.value;
		case "less-than-or-equal":
			return typeof tagValue === "number" && tagValue <= predicate.value;
	}
};

const evaluateTagPredicate = (tag: object, predicate: TagPredicate): boolean => {
	switch (predicate.type) {
		case "property": {
			const tagValue = (tag as Record<string, unknown>)[predicate.property];
			return evaluateTagPropertyPredicate(tagValue, predicate);
		}
		case "and":
			return predicate.predicates.every((sub) => evaluateTagPredicate(tag, sub));
		case "or":
			return predicate.predicates.some((sub) => evaluateTagPredicate(tag, sub));
		case "not":
			return !evaluateTagPredicate(tag, predicate.predicate);
	}
};

const intersectSets = <TElement>(sets: ReadonlySet<TElement>[]): Set<TElement> => {
	const [first, ...rest] = sets;
	const result = new Set(first);
	for (const set of rest) {
		for (const element of result) {
			if (!set.has(element)) result.delete(element);
		}
	}
	return result;
};

const unionSets = <TElement>(sets: ReadonlySet<TElement>[]): Set<TElement> => {
	const result = new Set<TElement>();
	for (const set of sets) {
		for (const element of set) result.add(element);
	}
	return result;
};

/**
 * Resolve a `TagSelector` into a concrete set of tag IDs by filtering the given
 * tag list. Adapters that pre-load all tags can compose this with their own
 * ObjectQuery compilation logic without paying the async overhead per node.
 */
export const evaluateTagSelectorAgainstTags = <TTag extends Tag>(
	selector: TagSelector<IdOf<TTag>>,
	allTags: readonly TTag[],
): Set<IdOf<TTag>> => {
	switch (selector.type) {
		case "tags-by-id":
			return new Set(selector.tagIds);

		case "tags-where":
			return new Set(
				allTags
					.values()
					.filter((tag) => evaluateTagPredicate(tag, selector.predicate))
					.map((tag) => tag.id as IdOf<TTag>),
			);

		case "tags-intersection": {
			if (selector.selectors.length === 0) return new Set();
			const sets = selector.selectors.map((sub) => evaluateTagSelectorAgainstTags(sub, allTags));
			return intersectSets(sets);
		}

		case "tags-union": {
			const sets = selector.selectors.map((sub) => evaluateTagSelectorAgainstTags(sub, allTags));
			return unionSets(sets);
		}

		case "tags-complement": {
			const exclude = evaluateTagSelectorAgainstTags(selector.selector, allTags);
			const result = new Set<IdOf<TTag>>();
			for (const tag of allTags) {
				const id = tag.id as IdOf<TTag>;
				if (!exclude.has(id)) result.add(id);
			}
			return result;
		}
	}
};

const evaluateTagSelector = async <TTag extends Tag>(
	selector: TagSelector<IdOf<TTag>>,
	getAllTags: () => Promise<TTag[]>,
): Promise<Set<IdOf<TTag>>> => evaluateTagSelectorAgainstTags<TTag>(selector, await getAllTags());

const collectAllTaggedObjects = async <TTag extends Tag>(
	storage: EvaluatorStorage<TTag>,
	getAllTags: () => Promise<TTag[]>,
): Promise<Set<ObjectKey>> => {
	const allTags = await getAllTags();
	const objectArrays = await Promise.all(
		allTags.values().map((tag) => storage.listTagObjects(tag.id as IdOf<TTag>)),
	);
	return new Set<ObjectKey>(objectArrays.flat());
};

const evaluateObjectQuery = async <TTag extends Tag>(
	query: ObjectQuery<IdOf<TTag>>,
	storage: EvaluatorStorage<TTag>,
	getAllTags: () => Promise<TTag[]>,
): Promise<Set<ObjectKey>> => {
	switch (query.type) {
		case "tagged-with-any": {
			const tagIds = await evaluateTagSelector(query.selector, getAllTags);
			if (tagIds.size === 0) return new Set();

			const objectArrays = await Promise.all(
				tagIds.values().map((tagId) => storage.listTagObjects(tagId)),
			);
			return new Set<ObjectKey>(objectArrays.flat());
		}

		case "tagged-with-all": {
			const tagIds = await evaluateTagSelector(query.selector, getAllTags);
			if (tagIds.size === 0) return new Set();

			const objectArrays = await Promise.all(
				tagIds.values().map((tagId) => storage.listTagObjects(tagId)),
			);
			const sets = objectArrays.map((arr) => new Set(arr));
			return intersectSets(sets);
		}

		case "and": {
			if (query.queries.length === 0) return new Set();

			const sets = await Promise.all(
				query.queries.values().map((sub) => evaluateObjectQuery(sub, storage, getAllTags)),
			);
			return intersectSets(sets);
		}

		case "or": {
			const sets = await Promise.all(
				query.queries.values().map((sub) => evaluateObjectQuery(sub, storage, getAllTags)),
			);
			return unionSets(sets);
		}

		case "not": {
			const [exclude, universe] = await Promise.all([
				evaluateObjectQuery(query.query, storage, getAllTags),
				collectAllTaggedObjects(storage, getAllTags),
			]);
			for (const objectKey of exclude) universe.delete(objectKey);
			return universe;
		}
	}
};

const finalize = (
	set: ReadonlySet<ObjectKey>,
	options: FindObjectsOptions | undefined,
): ObjectKey[] => {
	const sorted = Array.from(set).sort();
	const offset = options?.offset ?? 0;
	const end = options?.limit !== undefined ? offset + options.limit : undefined;
	return sorted.slice(offset, end);
};

/**
 * Evaluate an `ObjectQuery` in memory by walking the storage adapter's
 * `listTags` / `listTagObjects` endpoints. Storage adapters that cannot compile
 * queries to a backend-native form should delegate to this helper.
 */
export const evaluateObjectQueryInMemory = async <TTag extends Tag>(
	query: ObjectQuery<IdOf<TTag>>,
	storage: EvaluatorStorage<TTag>,
	options?: FindObjectsOptions,
): Promise<ObjectKey[]> => {
	const getAllTags = memoize(() => storage.listTags());
	const set = await evaluateObjectQuery(query, storage, getAllTags);
	return finalize(set, options);
};

/**
 * Count the number of object keys matching an `ObjectQuery` using the same
 * in-memory evaluation as {@link evaluateObjectQueryInMemory}.
 */
export const countObjectQueryInMemory = async <TTag extends Tag>(
	query: ObjectQuery<IdOf<TTag>>,
	storage: EvaluatorStorage<TTag>,
): Promise<number> => {
	const getAllTags = memoize(() => storage.listTags());
	const set = await evaluateObjectQuery(query, storage, getAllTags);
	return set.size;
};
