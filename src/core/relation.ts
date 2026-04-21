import type { ObjectKey, TagId } from "./ids.ts";

export interface TagRelation {
	readonly tagId: TagId;
	readonly objectKey: ObjectKey;
}
