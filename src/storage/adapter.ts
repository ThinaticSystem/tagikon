import type { ObjectKey, TagId } from "../core/ids.ts";
import type { TagKind } from "../core/tag-kind.ts";
import type { IdOf, Tag } from "../core/tag.ts";

// Default is the concrete base tag type (TagKind + TagId) so that unparameterized
// usage such as `new MemoryStorageAdapter()` remains fully type-safe.
export interface StorageAdapter<TTag extends Tag = Tag<TagKind, TagId>> {
	createTag(data: Omit<TTag, "id">): Promise<TTag>;
	getTag(id: IdOf<TTag>): Promise<null | TTag>;
	listTags(): Promise<TTag[]>;
	updateTag(id: IdOf<TTag>, patch: Partial<Omit<TTag, "id">>): Promise<TTag>;
	/**
	 * @returns Whether a tag was actually deleted (i.e. it existed before).
	 */
	deleteTag(id: IdOf<TTag>): Promise<boolean>;

	addRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	removeRelations(tagId: IdOf<TTag>, objectKeys: readonly ObjectKey[]): Promise<void>;
	listObjectTags(objectKey: ObjectKey): Promise<IdOf<TTag>[]>;
	listTagObjects(tagId: IdOf<TTag>): Promise<ObjectKey[]>;
}
