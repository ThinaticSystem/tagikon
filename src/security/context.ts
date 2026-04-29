import type { Permission, PermissionManifest } from "./permission.ts";

import { hasPermission } from "./permission.ts";

export interface SecurityContext {
	hasPermission: (permission: Permission) => boolean;
}

export const createSecurityContext = (manifest: PermissionManifest): SecurityContext =>
	Object.freeze({
		hasPermission: (permission: Permission) => hasPermission(manifest, permission),
	});
