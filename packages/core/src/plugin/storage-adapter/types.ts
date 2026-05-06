import type { ObjectKey } from "../../core/ids.ts";
import type { IdOf, Tag } from "../../core/tag.ts";
import type { FindObjectsOptions, ObjectQuery } from "../../query/types.ts";
import type { AuxStore } from "./aux-store.ts";
import type { AuxCodec, TagShape } from "./codec.ts";

/**
 * Pre-initialization interface for a storage adapter.
 *
 * This is the type accepted by `setupTagikon`. After calling `initialize`,
 * the adapter transitions to {@link StorageAdapter} and data operations become available.
 */
export interface StorageAdapterSetup<TTag extends Tag = Tag> {
	/**
	 * Initialize the adapter with the tag shape, providing both the ID provider
	 * (via `tagShape.id`) and per-property codecs for serialization.\
	 * Must be called exactly once before any data operation.
	 *
	 * @returns The initialized adapter ready for data operations.
	 */
	initialize(tagShape: TagShape<TTag>): StorageAdapter<TTag>;
}

export interface StorageAdapter<TTag extends Tag = Tag> {
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
	 * Find object keys matching the given query. Results are sorted
	 * lexicographically by the underlying object key string so that pagination
	 * is deterministic.
	 *
	 * Adapters that cannot compile the query natively should delegate to
	 * `evaluateObjectQueryInMemory` from `@tagikon/core`.
	 */
	findObjects(query: ObjectQuery<IdOf<TTag>>, options?: FindObjectsOptions): Promise<ObjectKey[]>;

	/**
	 * Count object keys matching the given query.
	 *
	 * Adapters that cannot compile the query natively should delegate to
	 * `countObjectQueryInMemory` from `@tagikon/core`.
	 */
	countObjects(query: ObjectQuery<IdOf<TTag>>): Promise<number>;

	/**
	 * Get the auxiliary data store for an extension. Used by the runtime to bind
	 * `ctx.aux` for each extension; the same `extensionId` returns the same store.
	 *
	 * Each extension sees only its own AuxStore — isolation across extensions is
	 * the runtime's responsibility (this method must not be exposed to extensions).
	 *
	 * If `auxCodec` is provided, the adapter uses it for serialization/deserialization
	 * instead of its default (typically JSON).
	 */
	getAuxStore<TData = unknown>(
		extensionId: symbol,
		auxCodec?: AuxCodec<TData>,
	): AuxStore<IdOf<TTag>, TData>;
}
