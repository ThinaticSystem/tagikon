import type { TagikonSchema } from "./schema.ts";
import type {
	FindObjectsOptions,
	ObjectQuery,
	TagPredicate,
	TagPropertyPredicate,
	TagSelector,
} from "@tagikon/core";
import type { SQL } from "drizzle-orm";

import { sql } from "drizzle-orm";

type Dialect = "sqlite" | "postgres";

/** Returns SQL that always produces zero rows for the tag ID set */
const emptyTagSet = (schema: TagikonSchema): SQL =>
	sql`SELECT ${schema.tags.id} FROM ${schema.tags} WHERE 1=0`;

/** Returns SQL that always produces zero rows for the object key set */
const emptyObjectSet = (schema: TagikonSchema): SQL =>
	sql`SELECT ${schema.relations.objectKey} FROM ${schema.relations} WHERE 1=0`;

const compilePropertyPredicate = (
	predicate: TagPropertyPredicate,
	schema: TagikonSchema,
	dialect: Dialect,
): SQL => {
	const { property, match, value } = predicate;

	switch (dialect) {
		case "sqlite": {
			// json_extract returns the JSON-typed value (number stays number, string stays string)
			const accessor = sql`json_extract(${schema.tags.data}, ${"$." + property})`;
			switch (match) {
				case "equal":
					return sql`${accessor} = ${value}`;
				case "contains":
					return sql`${accessor} LIKE ${"%" + String(value) + "%"}`;
				case "starts-with":
					return sql`${accessor} LIKE ${String(value) + "%"}`;
				case "ends-with":
					return sql`${accessor} LIKE ${"%" + String(value)}`;
				case "greater-than":
					return sql`${accessor} > ${value}`;
				case "less-than":
					return sql`${accessor} < ${value}`;
				case "greater-than-or-equal":
					return sql`${accessor} >= ${value}`;
				case "less-than-or-equal":
					return sql`${accessor} <= ${value}`;
			}
		}
		case "postgres": {
			// PostgreSQL: ->> returns TEXT; cast to numeric for comparison operators
			const textAccessor = sql`${schema.tags.data}::jsonb ->> ${property}`;
			const numericAccessor = sql`(${schema.tags.data}::jsonb ->> ${property})::numeric`;

			switch (match) {
				case "equal": {
					// Use numeric cast for number values so "5" text ≠ 5 integer bug is avoided
					if (typeof value === "number") {
						return sql`${numericAccessor} = ${value}`;
					}
					return sql`${textAccessor} = ${String(value)}`;
				}
				case "contains":
					return sql`${textAccessor} LIKE ${"%" + String(value) + "%"}`;
				case "starts-with":
					return sql`${textAccessor} LIKE ${String(value) + "%"}`;
				case "ends-with":
					return sql`${textAccessor} LIKE ${"%" + String(value)}`;
				case "greater-than":
					return sql`${numericAccessor} > ${value}`;
				case "less-than":
					return sql`${numericAccessor} < ${value}`;
				case "greater-than-or-equal":
					return sql`${numericAccessor} >= ${value}`;
				case "less-than-or-equal":
					return sql`${numericAccessor} <= ${value}`;
			}
		}
	}
};

const compileTagPredicate = (
	predicate: TagPredicate,
	schema: TagikonSchema,
	dialect: Dialect,
): SQL => {
	switch (predicate.type) {
		case "and": {
			if (predicate.predicates.length === 0) return sql`1=1`;
			return sql`(${sql.join(
				predicate.predicates.map((p) => compileTagPredicate(p, schema, dialect)),
				sql` AND `,
			)})`;
		}
		case "or": {
			if (predicate.predicates.length === 0) return sql`1=0`;
			return sql`(${sql.join(
				predicate.predicates.map((p) => compileTagPredicate(p, schema, dialect)),
				sql` OR `,
			)})`;
		}
		case "not":
			return sql`NOT (${compileTagPredicate(predicate.predicate, schema, dialect)})`;
		case "property":
			return compilePropertyPredicate(predicate, schema, dialect);
	}
};

const compileTagSelector = <TId>(
	selector: TagSelector<TId>,
	schema: TagikonSchema,
	dialect: Dialect,
	serialize: (id: TId) => string,
): SQL => {
	switch (selector.type) {
		case "tags-by-id": {
			if (selector.tagIds.length === 0) return emptyTagSet(schema);
			const params = selector.tagIds.map((id) => sql`${serialize(id)}`);
			return sql`SELECT ${schema.tags.id} FROM ${schema.tags} WHERE ${schema.tags.id} IN (${sql.join(params, sql`, `)})`;
		}
		case "tags-where": {
			const condition = compileTagPredicate(selector.predicate, schema, dialect);
			return sql`SELECT ${schema.tags.id} FROM ${schema.tags} WHERE ${condition}`;
		}
		case "tags-intersection": {
			if (selector.selectors.length === 0) return emptyTagSet(schema);
			// Each part is wrapped so compound selects are valid INTERSECT operands
			const parts = selector.selectors.map((s) => {
				const inner = compileTagSelector(s, schema, dialect, serialize);
				return sql`SELECT id FROM (${inner}) AS _isect`;
			});
			return sql.join(parts, sql` INTERSECT `);
		}
		case "tags-union": {
			if (selector.selectors.length === 0) return emptyTagSet(schema);
			const parts = selector.selectors.map((s) => {
				const inner = compileTagSelector(s, schema, dialect, serialize);
				return sql`SELECT id FROM (${inner}) AS _union`;
			});
			return sql.join(parts, sql` UNION `);
		}
		case "tags-complement": {
			const inner = compileTagSelector(selector.selector, schema, dialect, serialize);
			// Wrap inner in subquery so EXCEPT operand is always a simple SELECT
			return sql`SELECT ${schema.tags.id} FROM ${schema.tags} EXCEPT SELECT id FROM (${inner}) AS _comp`;
		}
	}
};

const compileObjectQuery = <TId>(
	query: ObjectQuery<TId>,
	schema: TagikonSchema,
	dialect: Dialect,
	serialize: (id: TId) => string,
): SQL => {
	switch (query.type) {
		case "tagged-with-any": {
			const selectorSql = compileTagSelector(query.selector, schema, dialect, serialize);
			return sql`SELECT DISTINCT ${schema.relations.objectKey} FROM ${schema.relations} WHERE ${schema.relations.tagId} IN (${selectorSql})`;
		}
		case "tagged-with-all": {
			// The selector SQL is embedded twice; parameters are bound twice accordingly
			const selectorSql = compileTagSelector(query.selector, schema, dialect, serialize);
			return sql`SELECT ${schema.relations.objectKey} FROM ${schema.relations} WHERE ${schema.relations.tagId} IN (${selectorSql}) GROUP BY ${schema.relations.objectKey} HAVING COUNT(DISTINCT ${schema.relations.tagId}) = (SELECT COUNT(*) FROM (${selectorSql}) AS _all_cnt)`;
		}
		case "and": {
			if (query.queries.length === 0) return emptyObjectSet(schema);
			// Wrap each sub-query so compound selects are valid INTERSECT operands
			const parts = query.queries.map((q) => {
				const inner = compileObjectQuery(q, schema, dialect, serialize);
				return sql`SELECT object_key FROM (${inner}) AS _and`;
			});
			return sql.join(parts, sql` INTERSECT `);
		}
		case "or": {
			if (query.queries.length === 0) return emptyObjectSet(schema);
			const parts = query.queries.map((q) => {
				const inner = compileObjectQuery(q, schema, dialect, serialize);
				return sql`SELECT object_key FROM (${inner}) AS _or`;
			});
			return sql.join(parts, sql` UNION `);
		}
		case "not": {
			const inner = compileObjectQuery(query.query, schema, dialect, serialize);
			// Universe = all object keys present in relations; wrap inner in subquery for EXCEPT
			return sql`SELECT DISTINCT ${schema.relations.objectKey} FROM ${schema.relations} EXCEPT SELECT object_key FROM (${inner}) AS _not`;
		}
	}
};

/**
 * Compile an `ObjectQuery` into a SQL statement that returns `object_key` rows
 * sorted lexicographically with optional `LIMIT` / `OFFSET` applied.
 */
export const compileFindObjects = <TId>(
	query: ObjectQuery<TId>,
	schema: TagikonSchema,
	dialect: Dialect,
	serialize: (id: TId) => string,
	options?: FindObjectsOptions,
): SQL => {
	const inner = compileObjectQuery(query, schema, dialect, serialize);
	let base: SQL = sql`SELECT object_key FROM (${inner}) AS _find ORDER BY object_key`;

	const { limit, offset } = options ?? {};
	if (limit !== undefined) {
		base = sql`${base} LIMIT ${limit}`;
	} else if (offset !== undefined && dialect === "sqlite") {
		// SQLite requires LIMIT when OFFSET is used; -1 means unlimited
		base = sql`${base} LIMIT -1`;
	}
	if (offset !== undefined) {
		base = sql`${base} OFFSET ${offset}`;
	}

	return base;
};

/**
 * Compile an `ObjectQuery` into a SQL statement that returns the COUNT of
 * distinct object keys matching the query.
 */
export const compileCountObjects = <TId>(
	query: ObjectQuery<TId>,
	schema: TagikonSchema,
	dialect: Dialect,
	serialize: (id: TId) => string,
): SQL => {
	const inner = compileObjectQuery(query, schema, dialect, serialize);
	return sql`SELECT COUNT(*) AS n FROM (${inner}) AS _count`;
};
