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
	TagsByIdSelector,
	TagsComplementSelector,
	TagsIntersectionSelector,
	TagsUnionSelector,
	TagsWhereSelector,
	TaggedWithAllQuery,
	TaggedWithAnyQuery,
} from "./types.ts";

//#region TagSelector builders
export const tagsById = <TId>(tagIds: readonly TId[]): TagsByIdSelector<TId> => ({
	type: "tags-by-id",
	tagIds,
});

export const tagsWhere = (predicate: TagPredicate): TagsWhereSelector => ({
	type: "tags-where",
	predicate,
});

export const intersectTags = <TId>(
	selectors: readonly TagSelector<TId>[],
): TagsIntersectionSelector<TId> => ({
	type: "tags-intersection",
	selectors,
});

export const unionTags = <TId>(selectors: readonly TagSelector<TId>[]): TagsUnionSelector<TId> => ({
	type: "tags-union",
	selectors,
});

export const complementTags = <TId>(selector: TagSelector<TId>): TagsComplementSelector<TId> => ({
	type: "tags-complement",
	selector,
});
//#endregion

//#region TagPredicate builders
export const propertyEqual = (property: string, value: unknown): TagPropertyEqualPredicate => ({
	type: "property",
	match: "equal",
	property,
	value,
});

export const propertyContains = (
	property: string,
	value: string,
): TagPropertyContainsPredicate => ({
	type: "property",
	match: "contains",
	property,
	value,
});

export const propertyStartsWith = (
	property: string,
	value: string,
): TagPropertyStartsWithPredicate => ({
	type: "property",
	match: "starts-with",
	property,
	value,
});

export const propertyEndsWith = (
	property: string,
	value: string,
): TagPropertyEndsWithPredicate => ({
	type: "property",
	match: "ends-with",
	property,
	value,
});

export const propertyGreaterThan = (
	property: string,
	value: number,
): TagPropertyGreaterThanPredicate => ({
	type: "property",
	match: "greater-than",
	property,
	value,
});

export const propertyLessThan = (
	property: string,
	value: number,
): TagPropertyLessThanPredicate => ({
	type: "property",
	match: "less-than",
	property,
	value,
});

export const propertyGreaterThanOrEqual = (
	property: string,
	value: number,
): TagPropertyGreaterThanOrEqualPredicate => ({
	type: "property",
	match: "greater-than-or-equal",
	property,
	value,
});

export const propertyLessThanOrEqual = (
	property: string,
	value: number,
): TagPropertyLessThanOrEqualPredicate => ({
	type: "property",
	match: "less-than-or-equal",
	property,
	value,
});

export const predicateAnd = (predicates: readonly TagPredicate[]): TagPredicateAnd => ({
	type: "and",
	predicates,
});

export const predicateOr = (predicates: readonly TagPredicate[]): TagPredicateOr => ({
	type: "or",
	predicates,
});

export const predicateNot = (predicate: TagPredicate): TagPredicateNot => ({
	type: "not",
	predicate,
});
//#endregion

//#region ObjectQuery builders
export const taggedWithAny = <TId>(selector: TagSelector<TId>): TaggedWithAnyQuery<TId> => ({
	type: "tagged-with-any",
	selector,
});

export const taggedWithAll = <TId>(selector: TagSelector<TId>): TaggedWithAllQuery<TId> => ({
	type: "tagged-with-all",
	selector,
});

export const and = <TId>(queries: readonly ObjectQuery<TId>[]): AndObjectQuery<TId> => ({
	type: "and",
	queries,
});

export const or = <TId>(queries: readonly ObjectQuery<TId>[]): OrObjectQuery<TId> => ({
	type: "or",
	queries,
});

export const not = <TId>(query: ObjectQuery<TId>): NotObjectQuery<TId> => ({
	type: "not",
	query,
});
//#endregion
