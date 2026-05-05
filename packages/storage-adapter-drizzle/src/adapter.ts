import type { TagikonSchema } from "./schema.ts";
import type {
	AuxStore,
	FindObjectsOptions,
	IdOf,
	IdProvider,
	ObjectKey,
	ObjectQuery,
	StorageAdapter,
	Tag,
} from "@tagikon/core";
import type { SQL } from "drizzle-orm";

import { TagNotFoundError } from "@tagikon/core";
import { and, eq, inArray } from "drizzle-orm";

import { compileCountObjects, compileFindObjects } from "./query-compiler.ts";

// Minimal structural type satisfied by all Drizzle database instances (SQLite, PostgreSQL, etc.)
// The query builder methods have the same shape across dialects, so `any` returns are intentional.
type DrizzleClient = { select: any; insert: any; update: any; delete: any };

type TagRow = { readonly id: string; readonly data: string };
type RelationRow = { readonly tagId: string; readonly objectKey: string };
type AuxRow = {
	readonly extensionKey: string;
	readonly tagId: string;
	readonly data: string;
};

const omitId = <TObject extends Tag>(tag: TObject): Omit<TObject, "id"> =>
	Object.fromEntries(Object.entries(tag).filter(([key]) => key !== "id")) as Omit<TObject, "id">;

const resolveExtensionKey = (extensionId: symbol): string => {
	const description = extensionId.description;
	if (description === undefined)
		throw new Error(
			"DrizzleStorageAdapter: extension symbols must have a description. " +
				"Use Symbol('my-extension') instead of Symbol().",
		);

	return description;
};

export class DrizzleStorageAdapter<TTag extends Tag = Tag> implements StorageAdapter<TTag> {
	readonly #db: DrizzleClient;
	readonly #schema: TagikonSchema;
	readonly #idPlugin: IdProvider<IdOf<TTag>>;
	readonly #auxStoreCache = new Map<symbol, AuxStore<IdOf<TTag>, unknown>>();

	constructor(db: DrizzleClient, schema: TagikonSchema, idPlugin: IdProvider<IdOf<TTag>>) {
		this.#db = db;
		this.#schema = schema;
		this.#idPlugin = idPlugin;
	}

	#rowToTag(row: TagRow): TTag {
		return { ...JSON.parse(row.data), id: this.#idPlugin.deserialize(row.id) } as TTag;
	}

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		const id = this.#idPlugin.generate();
		const serializedId = this.#idPlugin.serialize(id);

		await this.#db
			.insert(this.#schema.tags)
			.values({ id: serializedId, data: JSON.stringify(data) });

		return { ...data, id } as TTag;
	}

	async getTag(id: IdOf<TTag>): Promise<null | TTag> {
		const rows = (await this.#db
			.select()
			.from(this.#schema.tags)
			.where(eq(this.#schema.tags.id, this.#idPlugin.serialize(id)))) as TagRow[];

		const row = rows[0] ?? null;
		return row ? this.#rowToTag(row) : null;
	}

	async listTags(): Promise<TTag[]> {
		const rows = (await this.#db.select().from(this.#schema.tags)) as TagRow[];
		return rows.map((row) => this.#rowToTag(row));
	}

	async updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag> {
		const existing = await this.getTag(id);
		if (!existing) throw new TagNotFoundError(id);

		const updated = { ...existing, ...patch } as TTag;
		const storageData = omitId(updated);

		await this.#db
			.update(this.#schema.tags)
			.set({ data: JSON.stringify(storageData) })
			.where(eq(this.#schema.tags.id, this.#idPlugin.serialize(id)));

		return updated;
	}

	async deleteTag(id: IdOf<TTag>): Promise<boolean> {
		const existing = await this.getTag(id);
		if (!existing) return false;

		const serializedId = this.#idPlugin.serialize(id);

		await this.#db
			.delete(this.#schema.relations)
			.where(eq(this.#schema.relations.tagId, serializedId));

		await this.#db.delete(this.#schema.tags).where(eq(this.#schema.tags.id, serializedId));

		return true;
	}

	async addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		if (objectKeys.length === 0) return;

		const tagIdString = this.#idPlugin.serialize(tagId);
		const values = objectKeys.map((key) => ({ tagId: tagIdString, objectKey: key as string }));

		await this.#db.insert(this.#schema.relations).values(values).onConflictDoNothing();
	}

	async removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		if (objectKeys.length === 0) return;

		const tagIdString = this.#idPlugin.serialize(tagId);

		await this.#db.delete(this.#schema.relations).where(
			and(
				eq(this.#schema.relations.tagId, tagIdString),
				inArray(
					this.#schema.relations.objectKey,
					objectKeys.map((key) => key as string),
				),
			),
		);
	}

	async listObjectTags(objectKey: ObjectKey): Promise<IdOf<TTag>[]> {
		const rows = (await this.#db
			.select()
			.from(this.#schema.relations)
			.where(eq(this.#schema.relations.objectKey, objectKey as string))) as RelationRow[];

		return rows.map((row) => this.#idPlugin.deserialize(row.tagId));
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const rows = (await this.#db
			.select()
			.from(this.#schema.relations)
			.where(eq(this.#schema.relations.tagId, this.#idPlugin.serialize(tagId)))) as RelationRow[];

		return rows.map((row) => row.objectKey as ObjectKey);
	}

	async findObjects(
		query: ObjectQuery<IdOf<TTag>>,
		options?: FindObjectsOptions,
	): Promise<ObjectKey[]> {
		const compiledSql = compileFindObjects(
			query,
			this.#schema,
			this.#schema.dialect,
			(id) => this.#idPlugin.serialize(id),
			options,
		);
		const rows = await this.#executeRaw<{ object_key: string }>(compiledSql);
		return rows.map((row) => row.object_key as ObjectKey);
	}

	async countObjects(query: ObjectQuery<IdOf<TTag>>): Promise<number> {
		const compiledSql = compileCountObjects(query, this.#schema, this.#schema.dialect, (id) =>
			this.#idPlugin.serialize(id),
		);
		const rows = await this.#executeRaw<{ n: number | bigint }>(compiledSql);
		const row = rows[0];
		return row !== undefined ? Number(row.n) : 0;
	}

	// SQLite drizzle exposes `all()` for SELECT; PostgreSQL drizzle exposes `execute()`.
	// Cast to any to avoid binding the structural DrizzleClient type to a specific dialect.
	async #executeRaw<TRow extends object>(query: SQL): Promise<TRow[]> {
		const db = this.#db as any;
		switch (this.#schema.dialect) {
			case "sqlite":
				return db.all(query) as Promise<TRow[]>;
			case "postgres": {
				const result = await (db.execute(query) as Promise<{ rows: TRow[] }>);
				return result.rows;
			}
		}
	}

	getAuxStore<TData = unknown>(extensionId: symbol): AuxStore<IdOf<TTag>, TData> {
		const cached = this.#auxStoreCache.get(extensionId);
		if (cached) return cached as AuxStore<IdOf<TTag>, TData>;

		const extensionKey = resolveExtensionKey(extensionId);
		const schema = this.#schema;
		const db = this.#db;
		const serialize = (key: IdOf<TTag>): string => this.#idPlugin.serialize(key);
		const deserialize = (raw: string): IdOf<TTag> => this.#idPlugin.deserialize(raw);

		const store: AuxStore<IdOf<TTag>, TData> = {
			async find(key) {
				const rows = (await db
					.select()
					.from(schema.aux)
					.where(
						and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, serialize(key))),
					)) as AuxRow[];

				const row = rows[0] ?? null;
				return row ? (JSON.parse(row.data) as TData) : null;
			},

			async put(key, data) {
				const serializedData = JSON.stringify(data);
				await db
					.insert(schema.aux)
					.values({ extensionKey, tagId: serialize(key), data: serializedData })
					.onConflictDoUpdate({
						target: [schema.aux.extensionKey, schema.aux.tagId],
						set: { data: serializedData },
					});
			},

			async patch(key, partial) {
				const tagIdString = serialize(key);
				const rows = (await db
					.select()
					.from(schema.aux)
					.where(
						and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, tagIdString)),
					)) as AuxRow[];

				const row = rows[0] ?? null;
				if (!row) return null;

				const merged = { ...(JSON.parse(row.data) as TData), ...partial };
				await db
					.update(schema.aux)
					.set({ data: JSON.stringify(merged) })
					.where(and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, tagIdString)));

				return merged;
			},

			async delete(key) {
				const tagIdString = serialize(key);
				const rows = (await db
					.select()
					.from(schema.aux)
					.where(
						and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, tagIdString)),
					)) as AuxRow[];

				if (rows.length === 0) return false;

				await db
					.delete(schema.aux)
					.where(and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, tagIdString)));

				return true;
			},

			async list() {
				const rows = (await db
					.select()
					.from(schema.aux)
					.where(eq(schema.aux.extensionKey, extensionKey))) as AuxRow[];

				return rows.map(
					(row) => [deserialize(row.tagId), JSON.parse(row.data) as TData] as [IdOf<TTag>, TData],
				);
			},
		};

		this.#auxStoreCache.set(extensionId, store as AuxStore<IdOf<TTag>, unknown>);
		return store;
	}
}
