import { TagikonError } from "../core/errors.ts";

export type Permission = "tag:read" | "tag:write" | "relation:read" | "relation:write";

export interface PermissionManifest {
	readonly permissions: readonly Permission[];
}

export class PermissionMismatchError extends TagikonError {
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
