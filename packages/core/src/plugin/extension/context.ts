import type { IdOf, Tag } from "../../core/tag.ts";
import type { AuxStore } from "../storage-adapter/aux-store.ts";
import type { StorageAdapter } from "../storage-adapter/types.ts";

/**
 * The shared-storage surface exposed to an extension via {@link ExtensionContext.storage}.\
 * Same as {@link StorageAdapter} minus `getAuxStore`, which the runtime
 * binds separately so each extension only sees its own auxiliary store.
 */
export type ExtensionStorageView<TTag extends Tag> = Omit<StorageAdapter<TTag>, "getAuxStore">;

/**
 * Context object passed to every extension hook and API method as the
 * first argument. The runtime constructs one per extension and freezes it.
 *
 * - `storage` — shared tag/relation operations, narrowed to the
 *   permissions the extension acknowledged at registration time.
 * - `aux` — auxiliary key-value store private to this extension.
 *   Keyed by tag ID. Other extensions cannot reach this store.
 * - `api` — typed map of child extensions' custom APIs, keyed by each
 *   child's namespace symbol.
 *
 * @typeParam TTag - The tag type for this Tagikon instance.
 * @typeParam TAux - Type of values held in this extension's `aux` store.
 * @typeParam TChildrenApi - Map of child extension APIs keyed by their
 *   namespace symbols. Use {@link ChildrenApiOf} to derive automatically.
 */
export interface ExtensionContext<
	TTag extends Tag,
	TAux = unknown,
	TChildrenApi = Record<never, never>,
> {
	readonly storage: ExtensionStorageView<TTag>;
	readonly aux: AuxStore<IdOf<TTag>, TAux>;
	readonly api: TChildrenApi;
}

/**
 * Builds a frozen {@link ExtensionContext}.\
 * Primarily used by the runtime; exposed for advanced cases such as
 * unit-testing an extension's API methods in isolation.
 */
export const createExtensionContext = <
	TTag extends Tag,
	TAux = unknown,
	TChildrenApi = Record<never, never>,
>(
	storage: ExtensionStorageView<TTag>,
	aux: AuxStore<IdOf<TTag>, TAux>,
	api: TChildrenApi = {} as TChildrenApi,
): ExtensionContext<TTag, TAux, TChildrenApi> =>
	Object.freeze({
		storage,
		aux,
		api,
	});
