import type { ObjectKey, TagId } from "../../../core/ids.ts";
import type { IdOf, Tag } from "../../../core/tag.ts";
import type { IdProvider } from "../../../plugin/id-provider/types.ts";
import type { AuxStore } from "../../../plugin/storage-adapter/aux-store.ts";
import type { StorageAdapter } from "../../../plugin/storage-adapter/types.ts";

import { TagNotFoundError } from "../../../core/errors.ts";
import { UUID_ID_PROVIDER } from "../../id-providers/uuid-id-provider/index.ts";

export class MapStorageAdapter<TTag extends Tag = Tag<TagId>> implements StorageAdapter<TTag> {
	// Store tags keyed by their serialized id string for uniform lookup.
	readonly #tags = new Map<string, TTag>();
	// tagId string → Set of objectKey strings
	readonly #tagToObjects = new Map<string, Set<string>>();
	// objectKey string → Set of tagId strings
	readonly #objectToTags = new Map<string, Set<string>>();
	// extension symbol → its private auxiliary data map (keyed by serialized tag id)
	readonly #auxByExtension = new Map<symbol, Map<string, unknown>>();
	readonly #auxStoreWrappers = new Map<symbol, AuxStore<IdOf<TTag>, unknown>>();
	readonly #idPlugin: IdProvider<IdOf<TTag>>;

	constructor(options?: { idPlugin?: IdProvider<IdOf<TTag>> }) {
		this.#idPlugin = options?.idPlugin ?? (UUID_ID_PROVIDER as unknown as IdProvider<IdOf<TTag>>);
	}

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		const id = this.#idPlugin.generate();
		const tag = { ...data, id } as TTag;

		this.#tags.set(this.#idPlugin.serialize(id), tag);

		return tag;
	}

	async getTag(id: IdOf<TTag>): Promise<null | TTag> {
		return this.#tags.get(this.#idPlugin.serialize(id)) ?? null;
	}

	async listTags(): Promise<TTag[]> {
		return Array.from(this.#tags.values());
	}

	async updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag> {
		const key = this.#idPlugin.serialize(id);
		const existing = this.#tags.get(key);
		if (!existing) throw new TagNotFoundError(id as unknown as TagId);

		const updated = { ...existing, ...patch } as TTag;
		this.#tags.set(key, updated);

		return updated;
	}

	async deleteTag(id: IdOf<TTag>): Promise<boolean> {
		const key = this.#idPlugin.serialize(id);
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
		const tagIdString = this.#idPlugin.serialize(tagId);
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
		const tagIdString = this.#idPlugin.serialize(tagId);
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
			.map((raw) => this.#idPlugin.deserialize(raw))
			.toArray();
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const set = this.#tagToObjects.get(this.#idPlugin.serialize(tagId));
		if (!set) return [];

		return Array.from(set) as ObjectKey[];
	}

	getAuxStore<TData = unknown>(extensionId: symbol): AuxStore<IdOf<TTag>, TData> {
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

		const idPlugin = this.#idPlugin; // NOTE: avoid accessing `this` in wrapper methods
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
}
