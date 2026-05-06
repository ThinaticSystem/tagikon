import type { IdOf, Tag } from "../../core/tag.ts";
import type { AuxStore } from "../storage-adapter/aux-store.ts";
import type { StorageAdapter } from "../storage-adapter/types.ts";

/**
 * Storage view exposed to extensions. Hides `getAuxStore`
 * so extensions cannot reach into other extensions' AuxStores.
 */
export type ExtensionStorageView<TTag extends Tag> = Omit<StorageAdapter<TTag>, "getAuxStore">;

export interface ExtensionContext<
	TTag extends Tag,
	TAux = unknown,
	TChildrenApi = Record<never, never>,
> {
	readonly storage: ExtensionStorageView<TTag>;
	/**
	 * Auxiliary data store private to this extension.\
	 * Other extensions cannot read or write here.
	 */
	readonly aux: AuxStore<IdOf<TTag>, TAux>;
	/**
	 * Child extensions registered via `extensions: [...]`. Each entry is the\
	 * child's `CoreApi & customApi` bound to its own context.
	 */
	readonly api: TChildrenApi;
}

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
