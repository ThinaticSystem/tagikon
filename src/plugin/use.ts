import type { Tag } from "../core/tag.ts";
import type { Permission } from "../security/permission.ts";
import type { ApiShape, TaginkonPlugin } from "./types.ts";

import { PermissionMismatchError } from "../security/permission.ts";

export interface PluginRegistration<
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
> {
	// TTag is erased here; use() verifies compatibility at the call site
	readonly plugin: TaginkonPlugin<Tag, TNamespace, TApi>;
	readonly namespace: null | TNamespace;
	readonly permissions: ReadonlySet<Permission>;
}

export const use = <
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = Record<never, never>,
>(
	plugin: TaginkonPlugin<TTag, TNamespace, TApi>,
	options?: { readonly permissions: ReadonlySet<Permission> },
): PluginRegistration<TNamespace, TApi> => {
	const declared = new Set(plugin.permissions?.permissions ?? []);
	const acknowledged = new Set(options?.permissions ?? []);
	if (declared.symmetricDifference(acknowledged).size !== 0)
		throw new PermissionMismatchError(declared, acknowledged);

	return Object.freeze({
		plugin: plugin as unknown as TaginkonPlugin<Tag, TNamespace, TApi>,
		namespace: (plugin.namespace ?? null) as null | TNamespace,
		permissions: acknowledged,
	});
};
