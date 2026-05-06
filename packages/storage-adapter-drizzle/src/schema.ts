import {
	index as pgIndex,
	primaryKey as pgPrimaryKey,
	pgTable,
	text as pgText,
} from "drizzle-orm/pg-core";
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Options for {@link createTagikonSqliteSchema}.
 */
export interface CreateTagikonSqliteSchemaOptions {
	/**
	 * Prefix prepended to every table name (`<prefix>_tags`,
	 * `<prefix>_relations`, `<prefix>_aux`). Override when sharing a
	 * database with other schemas to avoid collisions.
	 *
	 * @default "tagikon"
	 */
	tablePrefix?: string;
}

//#region SQLite schema
/**
 * Builds the Drizzle table definitions for a SQLite-backed Tagikon store.\
 * The returned object can be passed to {@link DrizzleStorageAdapter} and
 * exposes `tags`, `relations`, `aux`, and `dialect: "sqlite"`.
 *
 * @example
 * ```ts
 * import { drizzle } from "drizzle-orm/better-sqlite3";
 * import Database from "better-sqlite3";
 * import { createTagikonSqliteSchema, DrizzleStorageAdapter } from "@tagikon/storage-adapter-drizzle";
 *
 * const schema = createTagikonSqliteSchema();
 * const db = drizzle(new Database("tags.db"));
 * const adapter = new DrizzleStorageAdapter(db, schema);
 * ```
 */
export const createTagikonSqliteSchema = ({
	tablePrefix = "tagikon",
}: CreateTagikonSqliteSchemaOptions = {}) => {
	const tags = sqliteTable(`${tablePrefix}_tags`, {
		id: text("id").primaryKey(),
		data: text("data").notNull(),
	});

	const relations = sqliteTable(
		`${tablePrefix}_relations`,
		{
			tagId: text("tag_id").notNull(),
			objectKey: text("object_key").notNull(),
		},
		(table) => [
			primaryKey({ columns: [table.tagId, table.objectKey] }),
			index(`${tablePrefix}_relations_object_key_idx`).on(table.objectKey),
		],
	);

	const aux = sqliteTable(
		`${tablePrefix}_aux`,
		{
			extensionKey: text("extension_key").notNull(),
			tagId: text("tag_id").notNull(),
			data: text("data").notNull(),
		},
		(table) => [primaryKey({ columns: [table.extensionKey, table.tagId] })],
	);

	return { tags, relations, aux, dialect: "sqlite" as const };
};
export type TagikonSqliteSchema = ReturnType<typeof createTagikonSqliteSchema>;
//#endregion

//#region PostgreSQL schema
/**
 * Options for {@link createTagikonPostgresqlSchema}.
 */
export interface CreateTagikonPostgresqlSchemaOptions {
	/**
	 * Prefix prepended to every table name. See
	 * {@link CreateTagikonSqliteSchemaOptions.tablePrefix}.
	 *
	 * @default "tagikon"
	 */
	tablePrefix?: string;
}

/**
 * Builds the Drizzle table definitions for a PostgreSQL-backed Tagikon store.\
 * Returned object exposes the same `tags` / `relations` / `aux` tables as
 * the SQLite schema but with `dialect: "postgres"` so the adapter can pick
 * dialect-aware JSON access (`::jsonb ->>`).
 */
export const createTagikonPostgresqlSchema = ({
	tablePrefix = "tagikon",
}: CreateTagikonPostgresqlSchemaOptions = {}) => {
	const tags = pgTable(`${tablePrefix}_tags`, {
		id: pgText("id").primaryKey(),
		data: pgText("data").notNull(),
	});

	const relations = pgTable(
		`${tablePrefix}_relations`,
		{
			tagId: pgText("tag_id").notNull(),
			objectKey: pgText("object_key").notNull(),
		},
		(table) => [
			pgPrimaryKey({ columns: [table.tagId, table.objectKey] }),
			pgIndex(`${tablePrefix}_relations_object_key_idx`).on(table.objectKey),
		],
	);

	const aux = pgTable(
		`${tablePrefix}_aux`,
		{
			extensionKey: pgText("extension_key").notNull(),
			tagId: pgText("tag_id").notNull(),
			data: pgText("data").notNull(),
		},
		(table) => [pgPrimaryKey({ columns: [table.extensionKey, table.tagId] })],
	);

	return { tags, relations, aux, dialect: "postgres" as const };
};
export type TagikonPostgresqlSchema = ReturnType<typeof createTagikonPostgresqlSchema>;
//#endregion

export type TagikonSchema = TagikonSqliteSchema | TagikonPostgresqlSchema;
