import type {
	AndObjectQuery,
	NotObjectQuery,
	ObjectQuery,
	OrObjectQuery,
	TagPredicate,
	TagPredicateAnd,
	TagPredicateNot,
	TagPredicateOr,
	TagPropertyContainsPredicate,
	TagPropertyEndsWithPredicate,
	TagPropertyEqualPredicate,
	TagPropertyGreaterThanOrEqualPredicate,
	TagPropertyGreaterThanPredicate,
	TagPropertyLessThanOrEqualPredicate,
	TagPropertyLessThanPredicate,
	TagPropertyStartsWithPredicate,
	TagSelector,
	TaggedWithAllQuery,
	TaggedWithAnyQuery,
	TagsByIdSelector,
	TagsComplementSelector,
	TagsIntersectionSelector,
	TagsUnionSelector,
	TagsWhereSelector,
} from "./types.ts";

//#region TagSelector builders

/**
 * Selects the tag set with the given IDs. Missing IDs are silently
 * ignored — the resulting selector matches whichever IDs do exist.
 *
 * @example
 * ```ts
 * await tagikon.findObjects(taggedWithAny(tagsById([urgentId, workId])));
 * ```
 */
export const tagsById = <TId>(tagIds: readonly TId[]): TagsByIdSelector<TId> => ({
	type: "tags-by-id",
	tagIds,
});

/**
 * Selects the tag set whose tags satisfy `predicate` (e.g. tags whose
 * `name` starts with `"urgent"`). Build predicates with {@link propertyEqual},
 * {@link propertyContains}, {@link propertyStartsWith}, etc.
 *
 * @example
 * ```ts
 * await tagikon.findObjects(
 *   taggedWithAny<MyId>(tagsWhere(propertyStartsWith("name", "urgent"))),
 * );
 * ```
 */
export const tagsWhere = (predicate: TagPredicate): TagsWhereSelector => ({
	type: "tags-where",
	predicate,
});

/**
 * Intersection of tag sets — tags present in **every** input selector.
 */
export const intersectTags = <TId>(
	selectors: readonly TagSelector<TId>[],
): TagsIntersectionSelector<TId> => ({
	type: "tags-intersection",
	selectors,
});

/**
 * Union of tag sets — tags present in **any** input selector.
 */
export const unionTags = <TId>(selectors: readonly TagSelector<TId>[]): TagsUnionSelector<TId> => ({
	type: "tags-union",
	selectors,
});

/**
 * Complement of a tag set — every tag **not** matched by `selector`.
 */
export const complementTags = <TId>(selector: TagSelector<TId>): TagsComplementSelector<TId> => ({
	type: "tags-complement",
	selector,
});
//#endregion

//#region TagPredicate builders

/**
 * Tag whose `property` equals `value`. The comparison is value-equality
 * after deserialization (depends on the property's codec).
 */
export const propertyEqual = (property: string, value: unknown): TagPropertyEqualPredicate => ({
	type: "property",
	match: "equal",
	property,
	value,
});

/** Tag whose string `property` contains `value` as a substring. */
export const propertyContains = (
	property: string,
	value: string,
): TagPropertyContainsPredicate => ({
	type: "property",
	match: "contains",
	property,
	value,
});

/** Tag whose string `property` starts with `value`. */
export const propertyStartsWith = (
	property: string,
	value: string,
): TagPropertyStartsWithPredicate => ({
	type: "property",
	match: "starts-with",
	property,
	value,
});

/** Tag whose string `property` ends with `value`. */
export const propertyEndsWith = (
	property: string,
	value: string,
): TagPropertyEndsWithPredicate => ({
	type: "property",
	match: "ends-with",
	property,
	value,
});

/** Tag whose numeric `property` is strictly greater than `value`. */
export const propertyGreaterThan = (
	property: string,
	value: number,
): TagPropertyGreaterThanPredicate => ({
	type: "property",
	match: "greater-than",
	property,
	value,
});

/** Tag whose numeric `property` is strictly less than `value`. */
export const propertyLessThan = (
	property: string,
	value: number,
): TagPropertyLessThanPredicate => ({
	type: "property",
	match: "less-than",
	property,
	value,
});

/** Tag whose numeric `property` is greater than or equal to `value`. */
export const propertyGreaterThanOrEqual = (
	property: string,
	value: number,
): TagPropertyGreaterThanOrEqualPredicate => ({
	type: "property",
	match: "greater-than-or-equal",
	property,
	value,
});

/** Tag whose numeric `property` is less than or equal to `value`. */
export const propertyLessThanOrEqual = (
	property: string,
	value: number,
): TagPropertyLessThanOrEqualPredicate => ({
	type: "property",
	match: "less-than-or-equal",
	property,
	value,
});

/** Logical AND of tag predicates — all must match. */
export const predicateAnd = (predicates: readonly TagPredicate[]): TagPredicateAnd => ({
	type: "and",
	predicates,
});

/** Logical OR of tag predicates — at least one must match. */
export const predicateOr = (predicates: readonly TagPredicate[]): TagPredicateOr => ({
	type: "or",
	predicates,
});

/** Logical NOT of a tag predicate. */
export const predicateNot = (predicate: TagPredicate): TagPredicateNot => ({
	type: "not",
	predicate,
});
//#endregion

//#region ObjectQuery builders

/**
 * Selects objects tagged with **at least one** tag from `selector`.\
 * Equivalent to a `WHERE tagId IN (...)` against the relations table.
 *
 * @example
 * ```ts
 * await tagikon.findObjects(taggedWithAny(tagsById([urgentId, workId])));
 * ```
 */
export const taggedWithAny = <TId>(selector: TagSelector<TId>): TaggedWithAnyQuery<TId> => ({
	type: "tagged-with-any",
	selector,
});

/**
 * Selects objects tagged with **all** tags from `selector`.\
 * Compiled adapters typically express this as repeated INTERSECTs.
 *
 * @example
 * ```ts
 * await tagikon.findObjects(taggedWithAll(tagsById([urgentId, workId])));
 * ```
 */
export const taggedWithAll = <TId>(selector: TagSelector<TId>): TaggedWithAllQuery<TId> => ({
	type: "tagged-with-all",
	selector,
});

/** Logical AND of object queries — objects matching **every** sub-query. */
export const and = <TId>(queries: readonly ObjectQuery<TId>[]): AndObjectQuery<TId> => ({
	type: "and",
	queries,
});

/** Logical OR of object queries — objects matching **at least one** sub-query. */
export const or = <TId>(queries: readonly ObjectQuery<TId>[]): OrObjectQuery<TId> => ({
	type: "or",
	queries,
});

/**
 * Logical NOT of an object query.\
 * The universe of `not` is **all object keys that have at least one tag**.
 * Tagikon has no concept of an object outside of tag relations, so `not(q)`
 * cannot return untagged objects.
 */
export const not = <TId>(query: ObjectQuery<TId>): NotObjectQuery<TId> => ({
	type: "not",
	query,
});
//#endregion
