import { TaginkonError } from "../core/errors.ts";

export type Permission = "tag:read" | "tag:write" | "relation:read" | "relation:write";

export interface PermissionManifest {
	readonly permissions: ReadonlySet<Permission>;
}

export class PermissionDeniedError extends TaginkonError {
	readonly name = "PermissionDeniedError";
	readonly permission: Permission;

	constructor(permission: Permission) {
		super(`Permission denied: ${permission}`);
		this.permission = permission;
	}
}

export const hasPermission = (manifest: PermissionManifest, permission: Permission): boolean =>
	manifest.permissions.has(permission);

export const assertPermission = (manifest: PermissionManifest, permission: Permission): void => {
	if (!hasPermission(manifest, permission)) {
		throw new PermissionDeniedError(permission);
	}
};

export class PermissionMismatchError extends TaginkonError {
	readonly name = "PermissionMismatchError";
	readonly declared: ReadonlySet<Permission>;
	readonly acknowledged: ReadonlySet<Permission>;

	constructor(declared: ReadonlySet<Permission>, acknowledged: ReadonlySet<Permission>) {
		super(
			`Permission mismatch: plugin declared [${[...declared].sort().join(", ")}], acknowledged [${[...acknowledged].sort().join(", ")}]`,
		);
		this.declared = declared;
		this.acknowledged = acknowledged;
	}
}
