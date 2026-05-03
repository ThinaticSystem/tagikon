export type TagCondition<TId> =
	| HasCondition<TId>
	| TagPropertyCondition
	| AndCondition<TId>
	| OrCondition<TId>
	| NotCondition<TId>;

export interface HasCondition<TId> {
	readonly type: "has";
	readonly tagId: TId;
}

export type TagPropertyCondition =
	| TagPropertyEqualCondition
	| TagPropertyContainsCondition
	| TagPropertyStartsWithCondition
	| TagPropertyEndsWithCondition
	| TagPropertyGreaterThanCondition
	| TagPropertyLessThanCondition
	| TagPropertyGreaterThanOrEqualCondition
	| TagPropertyLessThanOrEqualCondition;

export interface TagPropertyEqualCondition {
	readonly type: "tag-property";
	readonly match: "equal";
	readonly property: string;
	readonly value: unknown;
}

export interface TagPropertyContainsCondition {
	readonly type: "tag-property";
	readonly match: "contains";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyStartsWithCondition {
	readonly type: "tag-property";
	readonly match: "starts-with";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyEndsWithCondition {
	readonly type: "tag-property";
	readonly match: "ends-with";
	readonly property: string;
	readonly value: string;
}

export interface TagPropertyGreaterThanCondition {
	readonly type: "tag-property";
	readonly match: "greater-than";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyLessThanCondition {
	readonly type: "tag-property";
	readonly match: "less-than";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyGreaterThanOrEqualCondition {
	readonly type: "tag-property";
	readonly match: "greater-than-or-equal";
	readonly property: string;
	readonly value: number;
}

export interface TagPropertyLessThanOrEqualCondition {
	readonly type: "tag-property";
	readonly match: "less-than-or-equal";
	readonly property: string;
	readonly value: number;
}

export interface AndCondition<TId> {
	readonly type: "and";
	readonly conditions: readonly TagCondition<TId>[];
}

export interface OrCondition<TId> {
	readonly type: "or";
	readonly conditions: readonly TagCondition<TId>[];
}

export interface NotCondition<TId> {
	readonly type: "not";
	readonly condition: TagCondition<TId>;
}

export const has = <TId>(tagId: TId): HasCondition<TId> => ({ type: "has", tagId });

export const tagProperty = (property: string, value: unknown): TagPropertyEqualCondition => ({
	type: "tag-property",
	match: "equal",
	property,
	value,
});

export const tagPropertyContains = (
	property: string,
	value: string,
): TagPropertyContainsCondition => ({
	type: "tag-property",
	match: "contains",
	property,
	value,
});

export const tagPropertyStartsWith = (
	property: string,
	value: string,
): TagPropertyStartsWithCondition => ({
	type: "tag-property",
	match: "starts-with",
	property,
	value,
});

export const tagPropertyEndsWith = (
	property: string,
	value: string,
): TagPropertyEndsWithCondition => ({
	type: "tag-property",
	match: "ends-with",
	property,
	value,
});

export const tagPropertyGreaterThan = (
	property: string,
	value: number,
): TagPropertyGreaterThanCondition => ({
	type: "tag-property",
	match: "greater-than",
	property,
	value,
});

export const tagPropertyLessThan = (
	property: string,
	value: number,
): TagPropertyLessThanCondition => ({
	type: "tag-property",
	match: "less-than",
	property,
	value,
});

export const tagPropertyGreaterThanOrEqual = (
	property: string,
	value: number,
): TagPropertyGreaterThanOrEqualCondition => ({
	type: "tag-property",
	match: "greater-than-or-equal",
	property,
	value,
});

export const tagPropertyLessThanOrEqual = (
	property: string,
	value: number,
): TagPropertyLessThanOrEqualCondition => ({
	type: "tag-property",
	match: "less-than-or-equal",
	property,
	value,
});

export const and = <TId>(conditions: readonly TagCondition<TId>[]): AndCondition<TId> => ({
	type: "and",
	conditions,
});

export const or = <TId>(conditions: readonly TagCondition<TId>[]): OrCondition<TId> => ({
	type: "or",
	conditions,
});

export const not = <TId>(condition: TagCondition<TId>): NotCondition<TId> => ({
	type: "not",
	condition,
});
