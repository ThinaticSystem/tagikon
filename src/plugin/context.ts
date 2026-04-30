import type { Tag } from "../core/tag.ts";
import type { StorageAdapter } from "../storage/adapter.ts";

export interface PluginContext<TTag extends Tag> {
	readonly storage: StorageAdapter<TTag>;
}

export const createPluginContext = <TTag extends Tag>(
	storage: StorageAdapter<TTag>,
): PluginContext<TTag> =>
	Object.freeze({
		storage,
	});
