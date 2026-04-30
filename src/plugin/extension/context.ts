import type { Tag } from "../../core/tag.ts";
import type { StorageAdapter } from "../storage-adapter/types.ts";

export interface ExtensionContext<TTag extends Tag> {
	readonly storage: StorageAdapter<TTag>;
}

export const createExtensionContext = <TTag extends Tag>(
	storage: StorageAdapter<TTag>,
): ExtensionContext<TTag> =>
	Object.freeze({
		storage,
	});
