//#region TagPredicate
export type TagPredicate = TagPropertyPredicate | TagPredicateLogicalOperator;

export type TagPropertyPredicate =
	| TagPropertyEqualPredicate
	| TagPropertyContainsPredicate
	| TagPropertyStartsWithPredicate
	| TagPropertyEndsWithPredicate
	| TagPropertyGreaterThanPredicate
	| TagPropertyLessThanPredicate
	| TagPropertyGreaterThanOrEqualPredicate
	| TagPropertyLessThanOrEqualPredicate;

export type TagPredicateLogicalOperator = TagPredicateAnd | TagPredicateOr | TagPredicateNot;

export interface TagPropertyEqualPredicate {
	readonly type: "property";
	readonly match: "equal";
	readonly property: string;
	readonly value: unknown;
}

export interface TagPropertyContainsPredicate {
	readonly type: "property";
	readonly match: "contains";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyStartsWithPredicate {
	readonly type: "property";
	readonly match: "starts-with";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyEndsWithPredicate {
	readonly type: "property";
	readonly match: "ends-with";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyGreaterThanPredicate {
	readonly type: "property";
	readonly match: "greater-than";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyLessThanPredicate {
	readonly type: "property";
	readonly match: "less-than";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyGreaterThanOrEqualPredicate {
	readonly type: "property";
	readonly match: "greater-than-or-equal";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyLessThanOrEqualPredicate {
	readonly type: "property";
	readonly match: "less-than-or-equal";
	readonly property: string;
	readonly value: number;
}

export interface TagPredicateAnd {
	readonly type: "and";
	readonly predicates: readonly TagPredicate[];
}

export interface TagPredicateOr {
	readonly type: "or";
	readonly predicates: readonly TagPredicate[];
}

export interface TagPredicateNot {
	readonly type: "not";
	readonly predicate: TagPredicate;
}
//#endregion

//#region TagSelector
/**
 * `TagSelector` resolves to a set of tag IDs. Storage adapters may compile each
 * variant into a backend-native query (e.g. `INTERSECT` in SQL) or evaluate it
 * in memory through {@link evaluateObjectQueryInMemory}.
 *
 * The universe of `tags-complement` is **all tags** in the storage.
 */
export type TagSelector<TId> =
	| TagsByIdSelector<TId>
	| TagsWhereSelector
	| TagsIntersectionSelector<TId>
	| TagsUnionSelector<TId>
	| TagsComplementSelector<TId>;

export interface TagsByIdSelector<TId> {
	readonly type: "tags-by-id";
	readonly tagIds: readonly TId[];
}

export interface TagsWhereSelector {
	readonly type: "tags-where";
	readonly predicate: TagPredicate;
}

export interface TagsIntersectionSelector<TId> {
	readonly type: "tags-intersection";
	readonly selectors: readonly TagSelector<TId>[];
}

export interface TagsUnionSelector<TId> {
	readonly type: "tags-union";
	readonly selectors: readonly TagSelector<TId>[];
}

export interface TagsComplementSelector<TId> {
	readonly type: "tags-complement";
	readonly selector: TagSelector<TId>;
}
//#endregion

//#region ObjectQuery
/**
 * `ObjectQuery` filters object keys based on the tags they carry.
 *
 * The universe of `not` is **all object keys that have at least one tag**
 * (i.e. object keys present in the relations table). Tagikon has no concept of
 * an object outside of tag relations, so `not(q)` cannot return untagged
 * objects.
 */
export type ObjectQuery<TId> =
	| TaggedWithAnyQuery<TId>
	| TaggedWithAllQuery<TId>
	| AndObjectQuery<TId>
	| OrObjectQuery<TId>
	| NotObjectQuery<TId>;

export interface TaggedWithAnyQuery<TId> {
	readonly type: "tagged-with-any";
	readonly selector: TagSelector<TId>;
}

export interface TaggedWithAllQuery<TId> {
	readonly type: "tagged-with-all";
	readonly selector: TagSelector<TId>;
}

export interface AndObjectQuery<TId> {
	readonly type: "and";
	readonly queries: readonly ObjectQuery<TId>[];
}

export interface OrObjectQuery<TId> {
	readonly type: "or";
	readonly queries: readonly ObjectQuery<TId>[];
}

export interface NotObjectQuery<TId> {
	readonly type: "not";
	readonly query: ObjectQuery<TId>;
}
//#endregion

//#region FindObjectsOptions
export interface FindObjectsOptions {
	readonly limit?: number;
	readonly offset?: number;
}
//#endregion
