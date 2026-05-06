import { ExtensionError } from "../core/errors.ts";

/**
 * Permissions an extension may declare it needs to access shared storage:
 *
 * - `tag:read` — `getTag` / `listTags`
 * - `tag:write` — `createTag` / `updateTag` / `deleteTag`
 * - `relation:read` — `listObjectTags` / `listTagObjects` / `findObjects` / `countObjects`
 * - `relation:write` — `addRelations` / `removeRelations`
 */
export type Permission = "tag:read" | "tag:write" | "relation:read" | "relation:write";

/**
 * Set of permissions an extension declares it needs.\
 * The user passes a matching `acknowledged` set when registering the
 * extension via `use()`. A mismatch raises {@link PermissionMismatchError}
 * at registration time.
 */
export interface PermissionManifest {
	readonly permissions: readonly Permission[];
}

/**
 * Thrown at extension-registration time when the permissions declared by
 * the extension do not match those acknowledged by the user via `use()`.\
 * The user must update either side to match before registration succeeds.
 */
export class PermissionMismatchError extends ExtensionError {
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

/**
 * Thrown at runtime when an extension calls a `ctx.storage` method whose
 * required {@link Permission} was not declared in the extension's
 * {@link PermissionManifest}.
 */
export class PermissionDeniedError extends ExtensionError {
	readonly name = "PermissionDeniedError";
	readonly permission: Permission;

	constructor(permission: Permission) {
		super(`Storage operation requires "${permission}" permission`);
		this.permission = permission;
	}
}
