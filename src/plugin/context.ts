import type { Tag } from "../core/tag.ts";
import type { Permission } from "../security/permission.ts";
import type { StorageAdapter } from "../storage/adapter.ts";

import { createSecurityContext } from "../security/context.ts";

export interface PluginContext<TTag extends Tag> {
	readonly storage: StorageAdapter<TTag>;
	readonly hasPermission: (permission: Permission) => boolean;
}

export const createPluginContext = <TTag extends Tag>(
	storage: StorageAdapter<TTag>,
	permissions: ReadonlySet<Permission>,
): PluginContext<TTag> =>
	Object.freeze({
		storage,
		hasPermission: createSecurityContext({ permissions }).hasPermission,
	});
