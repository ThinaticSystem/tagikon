import type {
	ObjectQuery,
	TagPredicateLogicalOperator,
	TagPropertyPredicate,
	TagSelector,
} from "./types.ts";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { uuid } from "@tagikon/id-provider-uuid";
import { expect, suite, test } from "vitest";

import {
	and,
	complementTags,
	intersectTags,
	not,
	or,
	predicateAnd,
	predicateNot,
	predicateOr,
	propertyContains,
	propertyEndsWith,
	propertyEqual,
	propertyGreaterThan,
	propertyGreaterThanOrEqual,
	propertyLessThan,
	propertyLessThanOrEqual,
	propertyStartsWith,
	taggedWithAll,
	taggedWithAny,
	tagsById,
	tagsWhere,
	unionTags,
} from "./builders.ts";

suite("query builders", () => {
	suite("TagSelector", () => {
		const TYPES = {
			tagsById: "tags-by-id",
			tagsComplement: "tags-complement",
			tagsIntersection: "tags-intersection",
			tagsUnion: "tags-union",
			tagsWhere: "tags-where",
		} as const satisfies Record<string, TagSelector<unknown>["type"]>;

		test("tagsById returns a TagsByIdSelector", () => {
			const id = uuid("abc");

			const result = tagsById<Uuid>([id]);

			expect(result.type).toBe(TYPES.tagsById);
			expect(result.tagIds).toEqual([id]);
		});

		test("tagsWhere returns a TagsWhereSelector", () => {
			const selector = tagsWhere(propertyEqual("name", "foo"));

			expect(selector.type).toBe(TYPES.tagsWhere);
			expect(selector.predicate).toMatchObject({ type: "property", match: "equal" });
		});

		test("intersectTags returns a TagsIntersectionSelector", () => {
			const id = uuid("a");
			const selector = intersectTags<Uuid>([tagsById([id])]);

			expect(selector.type).toBe(TYPES.tagsIntersection);
			expect(selector.selectors).toHaveLength(1);
		});

		test("unionTags returns a TagsUnionSelector", () => {
			const id = uuid("a");
			const selector = unionTags<Uuid>([tagsById([id])]);

			expect(selector.type).toBe(TYPES.tagsUnion);
			expect(selector.selectors).toHaveLength(1);
		});

		test("complementTags returns a TagsComplementSelector", () => {
			const id = uuid("a");
			const selector = complementTags<Uuid>(tagsById([id]));

			expect(selector.type).toBe(TYPES.tagsComplement);
			expect(selector.selector.type).toBe(TYPES.tagsById);
		});
	});

	suite("TagPredicate", () => {
		const MATCHES = {
			equal: "equal",
			contains: "contains",
			startsWith: "starts-with",
			endsWith: "ends-with",
			greaterThan: "greater-than",
			lessThan: "less-than",
			greaterThanOrEqual: "greater-than-or-equal",
			lessThanOrEqual: "less-than-or-equal",
		} as const satisfies Record<string, TagPropertyPredicate["match"]>;

		test("propertyEqual returns equal-match predicate", () => {
			const predicate = propertyEqual("name", "foo");
			expect(predicate).toEqual({
				type: "property",
				match: MATCHES.equal,
				property: "name",
				value: "foo",
			});
		});

		test("propertyContains returns contains-match predicate", () => {
			expect(propertyContains("name", "oo")).toMatchObject({
				match: MATCHES.contains,
				value: "oo",
			});
		});

		test("propertyStartsWith returns starts-with predicate", () => {
			expect(propertyStartsWith("name", "fo")).toMatchObject({
				match: MATCHES.startsWith,
				value: "fo",
			});
		});

		test("propertyEndsWith returns ends-with predicate", () => {
			expect(propertyEndsWith("name", "oo")).toMatchObject({
				match: MATCHES.endsWith,
				value: "oo",
			});
		});

		test("propertyGreaterThan returns greater-than predicate", () => {
			expect(propertyGreaterThan("score", 10)).toMatchObject({
				match: MATCHES.greaterThan,
				value: 10,
			});
		});

		test("propertyLessThan returns less-than predicate", () => {
			expect(propertyLessThan("score", 10)).toMatchObject({
				match: MATCHES.lessThan,
				value: 10,
			});
		});

		test("propertyGreaterThanOrEqual returns gte predicate", () => {
			expect(propertyGreaterThanOrEqual("score", 10)).toMatchObject({
				match: MATCHES.greaterThanOrEqual,
				value: 10,
			});
		});

		test("propertyLessThanOrEqual returns lte predicate", () => {
			expect(propertyLessThanOrEqual("score", 10)).toMatchObject({
				match: MATCHES.lessThanOrEqual,
				value: 10,
			});
		});

		test("predicateAnd / predicateOr / predicateNot compose predicates", () => {
			const TYPES = {
				and: "and",
				or: "or",
				not: "not",
			} as const satisfies Record<string, TagPredicateLogicalOperator["type"]>;
			const a = propertyEqual("a", 1);
			const b = propertyEqual("b", 2);

			expect(predicateAnd([a, b])).toMatchObject({ type: TYPES.and, predicates: [a, b] });
			expect(predicateOr([a, b])).toMatchObject({ type: TYPES.or, predicates: [a, b] });
			expect(predicateNot(a)).toMatchObject({ type: TYPES.not, predicate: a });
		});
	});

	suite("ObjectQuery", () => {
		const TYPES = {
			taggedWithAny: "tagged-with-any",
			taggedWithAll: "tagged-with-all",
			and: "and",
			or: "or",
			not: "not",
		} as const satisfies Record<string, ObjectQuery<unknown>["type"]>;

		test("taggedWithAny / taggedWithAll wrap a TagSelector", () => {
			const id = uuid("a");
			const selector = tagsById<Uuid>([id]);
			expect(taggedWithAny(selector)).toMatchObject({
				type: TYPES.taggedWithAny,
				selector,
			});
			expect(taggedWithAll(selector)).toMatchObject({
				type: TYPES.taggedWithAll,
				selector,
			});
		});

		test("and / or / not compose ObjectQueries", () => {
			const id = uuid("a");
			const query = taggedWithAny(tagsById<Uuid>([id]));
			expect(and([query])).toMatchObject({ type: TYPES.and, queries: [query] });
			expect(or([query])).toMatchObject({ type: TYPES.or, queries: [query] });
			expect(not(query)).toMatchObject({ type: TYPES.not, query });
		});
	});
});
