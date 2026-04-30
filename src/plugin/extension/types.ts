import type { ObjectKey } from "../../core/ids.ts";
import type { IdOf, Tag } from "../../core/tag.ts";
import type { TagCondition } from "../../finder/condition.ts";
import type { HookPhases } from "../../hook/types.ts";
import type { PermissionManifest } from "../../security/permission.ts";
import type { StorageAdapter } from "../storage-adapter/types.ts";
import type { ExtensionContext } from "./context.ts";

//#region Hook input / output type aliases per operation
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

export type FindObjectsByTagsInput<TTag extends Tag> = { query: TagCondition<IdOf<TTag>> };
//#endregion

//#region Finder plugin
export interface FinderImplement<TTag extends Tag> {
	findObjectsByTags(
		query: TagCondition<IdOf<TTag>>,
		storage: StorageAdapter<TTag>,
	): Promise<ObjectKey[]>;
}
// #endregion

//#region Custom API
export type ApiShape = Record<string, (...args: readonly unknown[]) => unknown>;

type ApiImplementation<TTag extends Tag, TApi extends ApiShape> = {
	readonly [TKey in keyof TApi]: TApi[TKey] extends (...args: infer TArgs) => infer TReturn
		? (ctx: ExtensionContext<TTag>, ...args: TArgs) => TReturn
		: never;
};
// #endregion

//#region Extension interface
export interface Extension<
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
> {
	namespace?: TNamespace;
	/**
	 * Declare permissions your extension requires to function.\
	 * The server will check these against what is granted when registering the extension, and throw if they are not satisfied.
	 */
	permissions?: PermissionManifest;
	hooks?: {
		addTag?: HookPhases<AddTagInput<TTag>, TTag>;
		listTags?: HookPhases<ListTagsInput, TTag[]>;
		editTag?: HookPhases<EditTagInput<TTag>, TTag>;
		removeTag?: HookPhases<RemoveTagInput<TTag>, boolean>;
		tagObjects?: HookPhases<TagObjectsInput<TTag>, void>;
		untagObjects?: HookPhases<UntagObjectsInput<TTag>, void>;
		resetWithTags?: HookPhases<ResetWithTagsInput<TTag>, void>;
		findObjectsByTags?: HookPhases<FindObjectsByTagsInput<TTag>, ObjectKey[]>;
	};
	finder?: FinderImplement<TTag>;
	api?: ApiImplementation<TTag, TApi>;
}
// #endregion
