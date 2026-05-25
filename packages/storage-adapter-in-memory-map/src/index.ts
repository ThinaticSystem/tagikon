import type {
	AuxCodec,
	AuxStore,
	FindObjectsOptions,
	IdOf,
	IdProvider,
	ObjectKey,
	ObjectQuery,
	StorageAdapter,
	StorageAdapterSetup,
	Tag,
	TagShape,
} from "@tagikon/core";

import {
	StorageAdapterAlreadyInitializedError,
	StorageAdapterNotInitializedError,
	TagNotFoundError,
	countObjectQueryInMemory,
	evaluateObjectQueryInMemory,
} from "@tagikon/core";

/**
 * In-memory `Map`-backed implementation of {@link StorageAdapterSetup}.\
 * Suitable for tests, prototyping, and small in-process deployments.
 *
 * Implementation notes:
 *
 * - Tag CRUD and bidirectional relations are kept in plain `Map` /`Set`s.
 * - `findObjects` / `countObjects` delegate to `evaluateObjectQueryInMemory`
 *   / `countObjectQueryInMemory` from `@tagikon/core`, so behavior is
 *   guaranteed to match the in-memory evaluator (the reference semantics).
 * - Per-property codecs are ignored — values round-trip as-is.
 * - Each `getAuxStore(extensionId)` call returns the same `AuxStore`
 *   instance for a given symbol, but data persists only as long as the
 *   adapter is alive.
 *
 * Lifecycle: instantiate, call {@link MapStorageAdapter.initialize} once
 * (typically by passing the adapter to `setupTagikon`), then use freely.
 *
 * @example
 * ```ts
 * import { setupTagikon, tpc } from "@tagikon/core";
 * import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
 * import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
 *
 * const tagikon = setupTagikon({
 *   tagShape: { id: UUID_ID_PROVIDER, name: tpc.string() },
 *   storageAdapter: new MapStorageAdapter(),
 * });
 * ```
 */
export class MapStorageAdapter<
	TTag extends Tag = Tag<unknown>,
> implements StorageAdapterSetup<TTag> {
	// Store tags keyed by their serialized id string for uniform lookup.
	readonly #tags = new Map<string, TTag>();
	// tagId string → Set of objectKey strings
	readonly #tagToObjects = new Map<string, Set<string>>();
	// objectKey string → Set of tagId strings
	readonly #objectToTags = new Map<string, Set<string>>();
	// extension symbol → its private auxiliary data map (keyed by serialized tag id)
	readonly #auxByExtension = new Map<symbol, Map<string, unknown>>();
	readonly #auxStoreWrappers = new Map<symbol, AuxStore<IdOf<TTag>, unknown>>();
	// stableId string → migration version number
	readonly #migrationVersions = new Map<string, number>();
	/**
	 * DO NOT ACCESS DIRECTLY\
	 * Use {@link #idProvider} getter instead, which throws if this is not set yet.
	 */
	#_idProvider: IdProvider<IdOf<TTag>> | null = null;

	initialize(tagShape: TagShape<TTag>): StorageAdapter<TTag> {
		if (this.#_idProvider !== null)
			throw new StorageAdapterAlreadyInitializedError("MapStorageAdapter");
		this.#_idProvider = tagShape.id as IdProvider<IdOf<TTag>>;
		// In-memory storage needs no per-property codecs; tagShape other than id is intentionally ignored.
		return this;
	}

	get #idProvider(): IdProvider<IdOf<TTag>> {
		if (!this.#_idProvider) throw new StorageAdapterNotInitializedError("MapStorageAdapter");
		return this.#_idProvider;
	}

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		const id = this.#idProvider.generate();
		const tag = { ...data, id } as TTag;

		this.#tags.set(this.#idProvider.serialize(id), tag);

		return tag;
	}

	async getTag(id: IdOf<TTag>): Promise<null | TTag> {
		return this.#tags.get(this.#idProvider.serialize(id)) ?? null;
	}

	async listTags(): Promise<TTag[]> {
		return Array.from(this.#tags.values());
	}

	async updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag> {
		const key = this.#idProvider.serialize(id);
		const existing = this.#tags.get(key);
		if (!existing) throw new TagNotFoundError(id);

		const updated = { ...existing, ...patch } as TTag;
		this.#tags.set(key, updated);

		return updated;
	}

	async deleteTag(id: IdOf<TTag>): Promise<boolean> {
		const key = this.#idProvider.serialize(id);
		const existed = this.#tags.delete(key);

		if (existed) {
			const objectKeys = this.#tagToObjects.get(key);
			if (objectKeys) {
				for (const objectKey of objectKeys) {
					this.#objectToTags.get(objectKey)?.delete(key);
				}
				this.#tagToObjects.delete(key);
			}
		}

		return existed;
	}

	async addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		const tagIdString = this.#idProvider.serialize(tagId);

		const exist = this.#tags.get(tagIdString);
		if (!exist) throw new TagNotFoundError(tagId);

		let tagSet = this.#tagToObjects.get(tagIdString);
		if (!tagSet) {
			tagSet = new Set();
			this.#tagToObjects.set(tagIdString, tagSet);
		}

		for (const objectKey of objectKeys) {
			const objectKeyString = objectKey as string;

			tagSet.add(objectKeyString);

			let okSet = this.#objectToTags.get(objectKeyString);
			if (!okSet) {
				okSet = new Set();
				this.#objectToTags.set(objectKeyString, okSet);
			}
			okSet.add(tagIdString);
		}
	}

	async removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		const tagIdString = this.#idProvider.serialize(tagId);
		const tagSet = this.#tagToObjects.get(tagIdString);
		for (const objectKey of objectKeys) {
			const objectKeyString = objectKey as string;
			tagSet?.delete(objectKeyString);
			this.#objectToTags.get(objectKeyString)?.delete(tagIdString);
		}
	}

	async listObjectTags(objectKey: ObjectKey): Promise<IdOf<TTag>[]> {
		const set = this.#objectToTags.get(objectKey as string);
		if (!set) return [];

		return set
			.values()
			.map((raw) => this.#idProvider.deserialize(raw))
			.toArray();
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const set = this.#tagToObjects.get(this.#idProvider.serialize(tagId));
		if (!set) return [];

		return Array.from(set) as ObjectKey[];
	}

	async findObjects(
		query: ObjectQuery<IdOf<TTag>>,
		options?: FindObjectsOptions,
	): Promise<ObjectKey[]> {
		return evaluateObjectQueryInMemory<TTag>(query, this, options);
	}

	async countObjects(query: ObjectQuery<IdOf<TTag>>): Promise<number> {
		return countObjectQueryInMemory<TTag>(query, this);
	}

	// AuxCodec is ignored for the in-memory adapter — raw objects are stored directly,
	// so serialization is unnecessary and would add overhead with no benefit.
	getAuxStore<TData = unknown>(
		extensionId: symbol,
		_auxCodec?: AuxCodec<TData>,
	): AuxStore<IdOf<TTag>, TData> {
		const cached = this.#auxStoreWrappers.get(extensionId);
		if (cached) return cached as AuxStore<IdOf<TTag>, TData>;

		const bucket = ((): Map<string, TData> => {
			let value = this.#auxByExtension.get(extensionId);
			if (!value) {
				value = new Map<string, unknown>();
				this.#auxByExtension.set(extensionId, value);
			}
			return value as Map<string, TData>;
		})();

		const idPlugin = this.#idProvider; // capture once — avoid accessing `this` in wrapper methods
		const wrapper: AuxStore<IdOf<TTag>, TData> = {
			async find(key) {
				return bucket.get(idPlugin.serialize(key)) ?? null;
			},
			async put(key, data) {
				bucket.set(idPlugin.serialize(key), data);
			},
			async patch(key, partial) {
				const serialized = idPlugin.serialize(key);

				const existing = bucket.get(serialized);
				if (!existing) return null;

				const merged = { ...existing, ...partial };
				bucket.set(serialized, merged);
				return merged;
			},
			async delete(key) {
				return bucket.delete(idPlugin.serialize(key));
			},
			async list() {
				return bucket
					.entries()
					.map(
						([serialized, data]) => [idPlugin.deserialize(serialized), data] as [IdOf<TTag>, TData],
					)
					.toArray();
			},
		};
		this.#auxStoreWrappers.set(extensionId, wrapper as AuxStore<IdOf<TTag>, unknown>);

		return wrapper;
	}

	async getMigrationVersion(stableId: string): Promise<null | number> {
		return this.#migrationVersions.get(stableId) ?? null;
	}

	async setMigrationVersion(stableId: string, version: number): Promise<void> {
		this.#migrationVersions.set(stableId, version);
	}
}
