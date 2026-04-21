import type { ObjectKey } from "../core/ids.ts";
import type { IdOf, Tag } from "../core/tag.ts";
import type { HookPhases } from "../hook/types.ts";
import type { StorageAdapter } from "../storage/adapter.ts";

// ── Hook input / output type aliases per operation ──────────────────────────

export type AddTagInput<TTag extends Tag> = Omit<TTag, "id">;

export type EditTagInput<TTag extends Tag> = {
	id: IdOf<TTag>;
	patch: Partial<Omit<TTag, "id">>;
};

export type RemoveTagInput<TTag extends Tag> = { id: IdOf<TTag> };

export type TagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

export type UntagObjectsInput<TTag extends Tag> = {
	tagId: IdOf<TTag>;
	objectKeys: readonly ObjectKey[];
};

export type ResetWithTagsInput<TTag extends Tag> = {
	objectKey: ObjectKey;
	tagIds: readonly IdOf<TTag>[];
};

export type ListTagsInput = Record<never, never>;

export type FindObjectsByTagsInput = { query: unknown };

// ── Finder plugin ────────────────────────────────────────────────────────────

export interface FinderImplement<TTag extends Tag> {
	findObjectsByTags(query: unknown, storage: StorageAdapter<TTag>): Promise<ObjectKey[]>;
}

// ── Plugin interface ─────────────────────────────────────────────────────────

export interface TaginkonPlugin<TTag extends Tag> {
	addTag?: HookPhases<AddTagInput<TTag>, TTag>;
	listTags?: HookPhases<ListTagsInput, TTag[]>;
	editTag?: HookPhases<EditTagInput<TTag>, TTag>;
	removeTag?: HookPhases<RemoveTagInput<TTag>, void>;
	tagObjects?: HookPhases<TagObjectsInput<TTag>, void>;
	untagObjects?: HookPhases<UntagObjectsInput<TTag>, void>;
	resetWithTags?: HookPhases<ResetWithTagsInput<TTag>, void>;
	findObjectsByTags?: HookPhases<FindObjectsByTagsInput, ObjectKey[]>;
	finder?: FinderImplement<TTag>;
}
