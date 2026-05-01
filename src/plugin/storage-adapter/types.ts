import type { ObjectKey, TagId } from "../../core/ids.ts";
import type { IdOf, Tag } from "../../core/tag.ts";
import type { AuxStore } from "./aux-store.ts";

export interface StorageAdapter<TTag extends Tag = Tag<TagId>> {
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

	/**
	 * Get the auxiliary data store for an extension. Used by the runtime to bind
	 * `ctx.aux` for each extension; the same `extensionId` returns the same store.
	 *
	 * Each extension sees only its own AuxStore — isolation across extensions is
	 * the runtime's responsibility (this method must not be exposed to extensions).
	 */
	getAuxStore<TData = unknown>(extensionId: symbol): AuxStore<IdOf<TTag>, TData>;
}
