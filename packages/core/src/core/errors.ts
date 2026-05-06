import type { ObjectKey } from "./ids.ts";

/**
 * Base class for all errors thrown by Tagikon.\
 * Catch with `instanceof TagikonError` to distinguish library-originated
 * errors from user code errors.
 */
export class TagikonError extends Error {}

/**
 * Base class for errors caused by extension misuse, registration issues,
 * or runtime permission violations.
 */
export class ExtensionError extends TagikonError {}

/**
 * Base class for errors raised by storage adapter implementations
 * (lifecycle violations, serialization failures, etc.).
 */
export class StorageAdapterError extends TagikonError {}

/**
 * Base class for errors caused by malformed extension definitions
 * (e.g. missing namespace when API methods are present).
 */
export class IllegalExtensionDefinitionError extends ExtensionError {}

/**
 * Thrown when an extension declares `api` methods but does not declare
 * a `namespace` symbol to expose them under.
 */
export class NamespaceNotFoundError extends IllegalExtensionDefinitionError {
	readonly name = "NamespaceNotFoundError";
	readonly apiKeys: readonly string[];

	constructor(apiKeys: readonly string[]) {
		super(`Extension defines api methods [${apiKeys.join(", ")}] but no namespace was declared`);
		this.apiKeys = apiKeys;
	}
}

/**
 * Thrown when an operation references a tag that does not exist
 * (e.g. `editTag(unknownId, ...)` or `tagObjects(unknownId, ...)`).
 *
 * @typeParam TId - ID type of the missing tag (defaults to `unknown`).
 */
export class TagNotFoundError<TId = unknown> extends TagikonError {
	readonly name = "TagNotFoundError";
	readonly tagId: TId;

	constructor(tagId: TId) {
		super(`Tag not found: ${String(tagId)}`);
		this.tagId = tagId;
	}
}

/**
 * Thrown when an extension or adapter detects a name collision while
 * creating a tag. Whether this is enforced depends on the adapter
 * and any installed uniqueness extensions.
 */
export class TagAlreadyExistsError extends TagikonError {
	readonly name = "TagAlreadyExistsError";
	readonly tagName: string;

	constructor(tagName: string) {
		super(`Tag already exists: ${tagName}`);
		this.tagName = tagName;
	}
}

/**
 * Thrown by extensions or adapters when an operation requires a tag
 * to already be attached to an object but no such relation exists.
 *
 * @typeParam TId - ID type of the unrelated tag.
 */
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

/**
 * Thrown by `addTag` after the transform-hook phase if a property
 * declared as required by the tag shape is still missing.\
 * Extensions that supply default values via transform hooks (e.g.
 * `extension-default-attributes`) prevent this error from firing.
 */
export class RequiredPropertyMissingError extends TagikonError {
	readonly name = "RequiredPropertyMissingError";
	readonly propertyName: string;

	constructor(propertyName: string) {
		super(`Required tag property "${propertyName}" is missing`);
		this.propertyName = propertyName;
	}
}

/**
 * Thrown when a storage adapter's `initialize` is called more than once.\
 * Adapters are designed to be initialized exactly once by `setupTagikon`.
 */
export class StorageAdapterAlreadyInitializedError extends StorageAdapterError {
	readonly name = "StorageAdapterAlreadyInitializedError";
	readonly adapterName: string;

	constructor(adapterName: string) {
		super(`${adapterName}: initialize must only be called once.`);
		this.adapterName = adapterName;
	}
}

/**
 * Thrown when a storage adapter receives a data operation before
 * `initialize` has been called.
 */
export class StorageAdapterNotInitializedError extends StorageAdapterError {
	readonly name = "StorageAdapterNotInitializedError";
	readonly adapterName: string;

	constructor(adapterName: string) {
		super(`${adapterName}: initialize must be called before any operation.`);
		this.adapterName = adapterName;
	}
}
