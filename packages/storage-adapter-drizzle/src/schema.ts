import {
	index as pgIndex,
	primaryKey as pgPrimaryKey,
	pgTable,
	text as pgText,
} from "drizzle-orm/pg-core";
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export interface CreateTagikonSqliteSchemaOptions {
	/** Table name prefix for the schema. Useful to avoid conflicts when sharing a database. Default is "tagikon". */
	tablePrefix?: string;
}

//#region SQLite schema
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

	return { tags, relations, aux };
};
export type TagikonSqliteSchema = ReturnType<typeof createTagikonSqliteSchema>;
//#endregion

//#region PostgreSQL schema
export interface CreateTagikonPostgresqlSchemaOptions {
	/** Table name prefix for the schema. Useful to avoid conflicts when sharing a database. Default is "tagikon". */
	tablePrefix?: string;
}
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

	return { tags, relations, aux };
};
export type TagikonPostgresqlSchema = ReturnType<typeof createTagikonPostgresqlSchema>;
//#endregion

export type TagikonSchema = TagikonSqliteSchema | TagikonPostgresqlSchema;
