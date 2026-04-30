import type { TagId } from "../core/ids.ts";

export type TagCondition<TId = TagId> =
	| HasCondition<TId>
	| TagPropertyCondition
	| AndCondition<TId>
	| OrCondition<TId>
	| NotCondition<TId>;

export interface HasCondition<TId> {
	readonly type: "has";
	readonly tagId: TId;
}

export interface TagPropertyCondition {
	readonly type: "tag-property";
	readonly property: string;
	readonly value: unknown;
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

export const tagProperty = (property: string, value: unknown): TagPropertyCondition => ({
	type: "tag-property",
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
