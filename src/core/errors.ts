import type { ObjectKey, TagId } from "./ids.ts";

export class TaginkonError extends Error {}

export class TagNotFoundError extends TaginkonError {
	readonly name = "TagNotFoundError";
	readonly tagId: TagId;

	constructor(tagId: TagId) {
		super(`Tag not found: ${tagId}`);
		this.tagId = tagId;
	}
}

export class TagAlreadyExistsError extends TaginkonError {
	readonly name = "TagAlreadyExistsError";
	readonly tagName: string;

	constructor(tagName: string) {
		super(`Tag already exists: ${tagName}`);
		this.tagName = tagName;
	}
}

export class ObjectNotTaggedError extends TaginkonError {
	readonly name = "ObjectNotTaggedError";
	readonly tagId: TagId;
	readonly objectKey: ObjectKey;

	constructor(tagId: TagId, objectKey: ObjectKey) {
		super(`Object "${objectKey}" is not tagged with "${tagId}"`);
		this.tagId = tagId;
		this.objectKey = objectKey;
	}
}
