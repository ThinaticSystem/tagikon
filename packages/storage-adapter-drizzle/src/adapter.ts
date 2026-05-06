import type { TagikonSchema } from "./schema.ts";
import type {
	AuxCodec,
	AuxStore,
	FindObjectsOptions,
	IdOf,
	IdProvider,
	JsonPrimitive,
	ObjectKey,
	ObjectQuery,
	StorageAdapter,
	StorageAdapterSetup,
	Tag,
	TagShape,
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

/** Keys that could be used in prototype-pollution attacks; strip them from DB-sourced JSON. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const safeJsonParse = <TResult extends Record<string, unknown>>(raw: string): TResult => {
	const parsed = JSON.parse(raw) as Record<string, unknown>;
	return Object.fromEntries(
		Object.entries(parsed).filter(([key]) => !DANGEROUS_KEYS.has(key)),
	) as TResult;
};

export class DrizzleStorageAdapter<TTag extends Tag = Tag> implements StorageAdapterSetup<TTag> {
	readonly #db: DrizzleClient;
	readonly #schema: TagikonSchema;
	/**
	 * DO NOT ACCESS DIRECTLY\
	 * Use {@link #idProvider} getter instead, which throws if this is not set yet.
	 */
	#_idProvider: null | IdProvider<IdOf<TTag>> = null;
	#tagCodec: null | TagShape<TTag> = null;
	readonly #auxStoreCache = new Map<symbol, AuxStore<IdOf<TTag>, unknown>>();

	constructor(db: DrizzleClient, schema: TagikonSchema) {
		this.#db = db;
		this.#schema = schema;
	}

	initialize(tagShape: TagShape<TTag>): StorageAdapter<TTag> {
		if (this.#_idProvider !== null)
			// FIXME: Error class should extend TagikonError
			throw new Error("DrizzleStorageAdapter: initialize must only be called once.");
		this.#_idProvider = tagShape.id as IdProvider<IdOf<TTag>>;
		this.#tagCodec = tagShape;
		return this;
	}

	get #idProvider(): IdProvider<IdOf<TTag>> {
		if (!this.#_idProvider)
			// FIXME: Error class should extend TagikonError
			throw new Error("DrizzleStorageAdapter: initialize must be called before any operation.");
		return this.#_idProvider;
	}

	#serializeTagProps(data: Omit<TTag, "id">): string {
		if (!this.#tagCodec) return JSON.stringify(data);

		const codec = this.#tagCodec;
		const result = Object.entries(data).reduce<Record<string, JsonPrimitive>>(
			(acc, [key, value]) => {
				const propertyCodec = (
					codec as Record<string, undefined | { serialize: (v: unknown) => JsonPrimitive }>
				)[key];
				// NOTE: Don't use optional chaining here since a propertyCodec with a null JsonPrimitive value.
				acc[key] = propertyCodec ? propertyCodec.serialize(value) : (value as JsonPrimitive);
				return acc;
			},
			{},
		);
		return JSON.stringify(result);
	}

	#deserializeTagProps(raw: string): Omit<TTag, "id"> {
		const parsed = safeJsonParse<Record<string, JsonPrimitive>>(raw);
		if (!this.#tagCodec) return parsed as Omit<TTag, "id">;

		const codec = this.#tagCodec;
		const result = Object.entries(parsed).reduce<Record<string, unknown>>((acc, [key, value]) => {
			const propertyCodec = (
				codec as Record<string, { deserialize: (v: JsonPrimitive) => unknown } | undefined>
			)[key];
			// NOTE: Don't use optional chaining here since a propertyCodec with a nullish value.
			acc[key] = propertyCodec ? propertyCodec.deserialize(value) : value;
			return acc;
		}, {});
		return result as Omit<TTag, "id">;
	}

	#serializePropertyValue(property: string, value: unknown): JsonPrimitive {
		const codec = this.#tagCodec;
		if (!codec) return value as JsonPrimitive;

		const propertyCodec = (
			codec as Record<string, { serialize: (v: unknown) => JsonPrimitive } | undefined>
		)[property];
		// NOTE: Don't use optional chaining here since a propertyCodec with a null JsonPrimitive value.
		return propertyCodec ? propertyCodec.serialize(value) : (value as JsonPrimitive);
	}

	#rowToTag(row: TagRow): TTag {
		const props = this.#deserializeTagProps(row.data);
		return { ...props, id: this.#idProvider.deserialize(row.id) } as TTag;
	}

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		const id = this.#idProvider.generate();
		const serializedId = this.#idProvider.serialize(id);

		await this.#db
			.insert(this.#schema.tags)
			.values({ id: serializedId, data: this.#serializeTagProps(data) });

		return { ...data, id } as TTag;
	}

	async getTag(id: IdOf<TTag>): Promise<null | TTag> {
		const rows = (await this.#db
			.select()
			.from(this.#schema.tags)
			.where(eq(this.#schema.tags.id, this.#idProvider.serialize(id)))) as TagRow[];

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
			.set({ data: this.#serializeTagProps(storageData) })
			.where(eq(this.#schema.tags.id, this.#idProvider.serialize(id)));

		return updated;
	}

	async deleteTag(id: IdOf<TTag>): Promise<boolean> {
		const existing = await this.getTag(id);
		if (!existing) return false;

		const serializedId = this.#idProvider.serialize(id);

		await this.#db
			.delete(this.#schema.relations)
			.where(eq(this.#schema.relations.tagId, serializedId));

		await this.#db.delete(this.#schema.tags).where(eq(this.#schema.tags.id, serializedId));

		return true;
	}

	async addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		if (objectKeys.length === 0) return;

		const tagIdString = this.#idProvider.serialize(tagId);
		const values = objectKeys.map((key) => ({ tagId: tagIdString, objectKey: key as string }));

		await this.#db.insert(this.#schema.relations).values(values).onConflictDoNothing();
	}

	async removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		if (objectKeys.length === 0) return;

		const tagIdString = this.#idProvider.serialize(tagId);

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

		return rows.map((row) => this.#idProvider.deserialize(row.tagId));
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const rows = (await this.#db
			.select()
			.from(this.#schema.relations)
			.where(eq(this.#schema.relations.tagId, this.#idProvider.serialize(tagId)))) as RelationRow[];

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
			(id) => this.#idProvider.serialize(id),
			options,
			(property, value) => this.#serializePropertyValue(property, value),
		);
		const rows = await this.#executeRaw<{ object_key: string }>(compiledSql);
		return rows.map((row) => row.object_key as ObjectKey);
	}

	async countObjects(query: ObjectQuery<IdOf<TTag>>): Promise<number> {
		const compiledSql = compileCountObjects(
			query,
			this.#schema,
			this.#schema.dialect,
			(id) => this.#idProvider.serialize(id),
			(property, value) => this.#serializePropertyValue(property, value),
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

	getAuxStore<TData = unknown>(
		extensionId: symbol,
		auxCodec?: AuxCodec<TData>,
	): AuxStore<IdOf<TTag>, TData> {
		const cached = this.#auxStoreCache.get(extensionId);
		if (cached) return cached as AuxStore<IdOf<TTag>, TData>;

		const extensionKey = resolveExtensionKey(extensionId);
		const schema = this.#schema;
		const db = this.#db;
		const serialize = (key: IdOf<TTag>): string => this.#idProvider.serialize(key);
		const deserialize = (raw: string): IdOf<TTag> => this.#idProvider.deserialize(raw);

		const encodeData: (data: TData) => string = auxCodec
			? (data) => auxCodec.serialize(data)
			: (data) => JSON.stringify(data);
		const decodeData: (raw: string) => TData = auxCodec
			? (raw) => auxCodec.deserialize(raw)
			: (raw) => safeJsonParse(raw) as TData;

		const store: AuxStore<IdOf<TTag>, TData> = {
			async find(key) {
				const rows = (await db
					.select()
					.from(schema.aux)
					.where(
						and(eq(schema.aux.extensionKey, extensionKey), eq(schema.aux.tagId, serialize(key))),
					)) as AuxRow[];

				const row = rows[0] ?? null;
				return row ? decodeData(row.data) : null;
			},

			async put(key, data) {
				const serializedData = encodeData(data);
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

				const merged = { ...decodeData(row.data), ...partial } as TData;
				await db
					.update(schema.aux)
					.set({ data: encodeData(merged) })
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
					(row) => [deserialize(row.tagId), decodeData(row.data)] as [IdOf<TTag>, TData],
				);
			},
		};

		this.#auxStoreCache.set(extensionId, store as AuxStore<IdOf<TTag>, unknown>);
		return store;
	}
}
