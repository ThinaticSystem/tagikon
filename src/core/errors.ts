import type { ObjectKey } from "./ids.ts";

export class TagikonError extends Error {}

export class ExtensionError extends TagikonError {}

export class IllegalExtensionDefinitionError extends ExtensionError {}

export class NamespaceNotFoundError extends IllegalExtensionDefinitionError {
	readonly name = "NamespaceNotFoundError";
	readonly apiKeys: readonly string[];

	constructor(apiKeys: readonly string[]) {
		super(`Extension defines api methods [${apiKeys.join(", ")}] but no namespace was declared`);
		this.apiKeys = apiKeys;
	}
}

export class TagNotFoundError<TId = unknown> extends TagikonError {
	readonly name = "TagNotFoundError";
	readonly tagId: TId;

	constructor(tagId: TId) {
		super(`Tag not found: ${String(tagId)}`);
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

export class ObjectNotTaggedError<TId = unknown> extends TagikonError {
	readonly name = "ObjectNotTaggedError";
	readonly tagId: TId;
	readonly objectKey: ObjectKey;

	constructor(tagId: TId, objectKey: ObjectKey) {
		super(`Object "${objectKey}" is not tagged with "${String(tagId)}"`);
		this.tagId = tagId;
		this.objectKey = objectKey;
	}
}
