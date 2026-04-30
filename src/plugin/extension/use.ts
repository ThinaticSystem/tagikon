import type { Tag } from "../../core/tag.ts";
import type { Permission } from "../../security/permission.ts";
import type { ApiShape, Extension } from "./types.ts";

import { PermissionMismatchError } from "../../security/permission.ts";

export interface UseOptions {
	/**
	 * Permissions to grant when registering the extension.\
	 * This should perfectly match what the extension declares in its `permissions` property.\
	 */
	readonly permissions: readonly Permission[];
}

export interface ExtensionRegistration<
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
> {
	// TTag is erased here; use() verifies compatibility at the call site
	readonly extension: Extension<Tag, TNamespace, TApi>;
	readonly namespace: null | TNamespace;
	readonly permissions: ReadonlySet<Permission>;
}

export const use = <
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
>(
	extension: Extension<TTag, TNamespace, TApi>,
	options?: UseOptions,
): ExtensionRegistration<TNamespace, TApi> => {
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
