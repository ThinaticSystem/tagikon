import type { TagId } from "../core/ids.ts";

import { tagId } from "../core/ids.ts";

export interface TagIdPlugin<TId> {
	readonly generate: () => TId;
	readonly serialize: (id: TId) => string;
	readonly deserialize: (raw: string) => TId;
}

// Convenience factory for plugins where TId extends string.
// serialize is identity; deserialize narrows string→TId, safe because TId ⊆ string at runtime.
export const stringTagIdPlugin = <TId extends string>(generate: () => TId): TagIdPlugin<TId> => ({
	generate,
	serialize: (id) => id,
	deserialize: (raw) => raw as TId,
});

export const UUID_TAG_ID_PLUGIN: TagIdPlugin<TagId> = stringTagIdPlugin(() =>
	tagId(crypto.randomUUID()),
);
