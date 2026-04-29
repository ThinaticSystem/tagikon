import type { ObjectKey, TagId } from "../core/ids.ts";
import type { TagKind } from "../core/tag-kind.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { TagIdPlugin } from "../plugin/tag-id-plugin.ts";
import type { StorageAdapter } from "./adapter.ts";

import { TagAlreadyExistsError, TagNotFoundError } from "../core/errors.ts";
import { UUID_TAG_ID_PLUGIN } from "../plugin/tag-id-plugin.ts";

export class MemoryStorageAdapter<
	TTag extends Tag = Tag<TagKind, TagId>,
> implements StorageAdapter<TTag> {
	// Store tags keyed by their serialized id string for uniform lookup.
	readonly #tags = new Map<string, TTag>();
	// tagId string → Set of objectKey strings
	readonly #tagToObjects = new Map<string, Set<string>>();
	// objectKey string → Set of tagId strings
	readonly #objectToTags = new Map<string, Set<string>>();
	readonly #idPlugin: TagIdPlugin<IdOf<TTag>>;

	constructor(options?: { idPlugin?: TagIdPlugin<IdOf<TTag>> }) {
		this.#idPlugin =
			options?.idPlugin ?? (UUID_TAG_ID_PLUGIN as unknown as TagIdPlugin<IdOf<TTag>>);
	}

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		if (this.#tags.values().find(({ name }) => name === data.name))
			throw new TagAlreadyExistsError(data.name);

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

		return Array.from(set).map((raw) => this.#idPlugin.deserialize(raw));
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const set = this.#tagToObjects.get(this.#idPlugin.serialize(tagId));
		if (!set) return [];

		return Array.from(set) as ObjectKey[];
	}
}
