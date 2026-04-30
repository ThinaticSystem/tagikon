import type { ObjectKey, TagId } from "./ids.ts";

export class TagikonError extends Error {}

export class TagNotFoundError extends TagikonError {
	readonly name = "TagNotFoundError";
	readonly tagId: TagId;

	constructor(tagId: TagId) {
		super(`Tag not found: ${tagId}`);
		this.tagId = tagId;
	}
}

export class TagAlreadyExistsError extends TagikonError {
	readonly name = "TagAlreadyExistsError";
	readonly tagName: string;

	constructor(tagName: string) {
		super(`Tag already exists: ${tagName}`);
		this.tagName = tagName;
	}
}

export class ObjectNotTaggedError extends TagikonError {
	readonly name = "ObjectNotTaggedError";
	readonly tagId: TagId;
	readonly objectKey: ObjectKey;

	constructor(tagId: TagId, objectKey: ObjectKey) {
		super(`Object "${objectKey}" is not tagged with "${tagId}"`);
		this.tagId = tagId;
		this.objectKey = objectKey;
	}
}
