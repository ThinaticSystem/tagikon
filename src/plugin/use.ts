import type { Tag } from "../core/tag.ts";
import type { Permission } from "../security/permission.ts";
import type { ApiShape, TagikonPlugin } from "./types.ts";

import { PermissionMismatchError } from "../security/permission.ts";

export interface UseOptions {
	/**
	 * Permissions to grant when registering the plugin.\
	 * This should perfectly match what the plugin declares in its `permissions` property.\
	 */
	readonly permissions: readonly Permission[];
}

export interface PluginRegistration<
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
> {
	// TTag is erased here; use() verifies compatibility at the call site
	readonly plugin: TagikonPlugin<Tag, TNamespace, TApi>;
	readonly namespace: null | TNamespace;
	readonly permissions: ReadonlySet<Permission>;
}

export const use = <
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
>(
	plugin: TagikonPlugin<TTag, TNamespace, TApi>,
	options?: UseOptions,
): PluginRegistration<TNamespace, TApi> => {
	const declared = new Set(plugin.permissions?.permissions ?? []);
	const acknowledged = new Set(options?.permissions ?? []);
	if (declared.symmetricDifference(acknowledged).size !== 0)
		throw new PermissionMismatchError(declared, acknowledged);

	return Object.freeze({
		plugin: plugin as unknown as TagikonPlugin<Tag, TNamespace, TApi>,
		namespace: (plugin.namespace ?? null) as null | TNamespace,
		permissions: acknowledged,
	});
};
