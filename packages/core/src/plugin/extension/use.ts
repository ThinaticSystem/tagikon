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
