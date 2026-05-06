import type { Tag } from "../../core/tag.ts";
import type { Permission } from "../../security/permission.ts";
import type { ApiShape, Extension, ExtensionRegistration } from "./types.ts";

import { NamespaceNotFoundError } from "../../core/errors.ts";
import { PermissionMismatchError } from "../../security/permission.ts";

export type { ExtensionRegistration } from "./types.ts";

export interface UseOptions {
	/**
	 * Permissions to grant when registering the extension.\
	 * This should perfectly match what the extension declares in its `permissions` property.\
	 */
	readonly permissions: readonly Permission[];
}

/**
 * Registers an extension for inclusion in a Tagikon instance or as a
 * child of another extension.\
 * The result is an {@link ExtensionRegistration} — pass it to
 * {@link setupTagikon}'s `extensions` field or to a parent extension's
 * `extensions` field.
 *
 * The user must explicitly acknowledge the permissions declared by the
 * extension. Mismatches raise {@link PermissionMismatchError} at
 * registration time so authorization issues are surfaced eagerly.
 *
 * @throws {@link NamespaceNotFoundError} if the extension has API methods
 *   but no `namespace` symbol.
 * @throws {@link PermissionMismatchError} if `options.permissions` does
 *   not exactly match the extension's declared permissions.
 *
 * @example
 * ```ts
 * import { use } from "@tagikon/core";
 * import { createHierarchy } from "@tagikon/extension-hierarchy";
 *
 * const hierarchy = use(createHierarchy(), {
 *   permissions: ["tag:read", "tag:write"],
 * });
 *
 * const tagikon = setupTagikon({ tagShape, storageAdapter, extensions: [hierarchy] });
 * ```
 */
export const use = <
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = {},
	TAux = unknown,
	TChildrenApi extends ApiShape = {},
>(
	extension: Extension<TTag, TNamespace, TApi, TAux, TChildrenApi>,
	options?: UseOptions,
): ExtensionRegistration<TNamespace, TApi> => {
	// NOTE: An empty object is treated as unspecified
	const apiKeys = Object.keys(extension.api ?? {});
	if (apiKeys.length > 0 && !extension.namespace) throw new NamespaceNotFoundError(apiKeys);

	const declared = new Set(extension.permissions?.permissions ?? []);
	const acknowledged = new Set(options?.permissions ?? []);
	if (declared.symmetricDifference(acknowledged).size !== 0)
		throw new PermissionMismatchError(declared, acknowledged);

	return Object.freeze({
		extension: extension as unknown as Extension<Tag, TNamespace, TApi>,
		namespace: (extension.namespace ?? null) as null | TNamespace,
		permissions: acknowledged,
	});
};
