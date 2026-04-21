import type { ObjectKey, TagId } from "../core/ids.ts";
import type { TagKind } from "../core/tag-kind.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { StorageAdapter } from "./adapter.ts";

import { TagAlreadyExistsError, TagNotFoundError } from "../core/errors.ts";
import { tagId } from "../core/ids.ts";

export class MemoryStorageAdapter<
	TTag extends Tag = Tag<TagKind, TagId>,
> implements StorageAdapter<TTag> {
	// Store tags keyed by their serialized id string for uniform lookup.
	private readonly tags = new Map<string, TTag>();
	// tagId string → Set of objectKey strings
	private readonly tagToObjects = new Map<string, Set<string>>();
	// objectKey string → Set of tagId strings
	private readonly objectToTags = new Map<string, Set<string>>();

	async createTag(data: Omit<TTag, "id">): Promise<TTag> {
		for (const existing of this.tags.values()) {
			if (existing.name === data.name) {
				throw new TagAlreadyExistsError(data.name);
			}
		}
		const id = tagId(crypto.randomUUID()) as unknown as IdOf<TTag>;
		const tag = { ...data, id } as TTag;
		this.tags.set(id as string, tag);
		return tag;
	}

	async getTag(id: IdOf<TTag>): Promise<null | TTag> {
		return this.tags.get(id as string) ?? null;
	}

	async listTags(): Promise<TTag[]> {
		return Array.from(this.tags.values());
	}

	async updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag> {
		const existing = this.tags.get(id as string);
		if (!existing) {
			throw new TagNotFoundError(id as unknown as TagId);
		}
		const updated = { ...existing, ...patch } as TTag;
		this.tags.set(id as string, updated);
		return updated;
	}

	async deleteTag(id: IdOf<TTag>): Promise<boolean> {
		const existed = this.tags.delete(id as string);
		if (existed) {
			const objectKeys = this.tagToObjects.get(id as string);
			if (objectKeys) {
				for (const ok of objectKeys) {
					this.objectToTags.get(ok)?.delete(id as string);
				}
				this.tagToObjects.delete(id as string);
			}
		}
		return existed;
	}

	async addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		const tidStr = tagId as string;
		let tagSet = this.tagToObjects.get(tidStr);
		if (!tagSet) {
			tagSet = new Set();
			this.tagToObjects.set(tidStr, tagSet);
		}
		for (const ok of objectKeys) {
			const okStr = ok as string;
			tagSet.add(okStr);
			let okSet = this.objectToTags.get(okStr);
			if (!okSet) {
				okSet = new Set();
				this.objectToTags.set(okStr, okSet);
			}
			okSet.add(tidStr);
		}
	}

	async removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void> {
		const tidStr = tagId as string;
		const tagSet = this.tagToObjects.get(tidStr);
		for (const ok of objectKeys) {
			const okStr = ok as string;
			tagSet?.delete(okStr);
			this.objectToTags.get(okStr)?.delete(tidStr);
		}
	}

	async listObjectTags(objectKey: ObjectKey): Promise<IdOf<TTag>[]> {
		const set = this.objectToTags.get(objectKey as string);
		if (!set) return [];
		return Array.from(set) as IdOf<TTag>[];
	}

	async listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]> {
		const set = this.tagToObjects.get(tagId as string);
		if (!set) return [];
		return Array.from(set) as ObjectKey[];
	}
}
