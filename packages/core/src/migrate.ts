import type { Tag } from "./core/tag.ts";
import type { ApiShape, ExtensionRegistration } from "./plugin/extension/types.ts";
import type { TagFromShape } from "./plugin/storage-adapter/codec.ts";
import type { StorageAdapter, StorageAdapterSetup, StorageAdapterWithMigrations } from "./plugin/storage-adapter/types.ts";

import { ExtensionMigrationStepError, InvalidExtensionMigrationError } from "./core/errors.ts";

// 'any' in serialize is required: concrete IdProvider<X> is contravariant in X,
// so (id: Uuid)=>string is NOT assignable to (id: unknown)=>string.
type AnyIdProvider = {
	readonly generate: () => unknown;
	readonly serialize: (id: any) => string;
	readonly deserialize: (raw: string) => unknown;
};
type AnyTagShape = { readonly id: AnyIdProvider } & Record<string, unknown>;

type AnyExtension = ExtensionRegistration<symbol, ApiShape>["extension"];

/**
 * Options for {@link migrateTagikon} — same shape as `SetupTagikonOptions`
 * but `storageAdapter` must be a pre-initialization setup object so that
 * `migrateTagikon` can call optional schema migrations before `initialize`.
 *
 * @typeParam TShape - Tag shape (inferred from `tagShape`).
 * @typeParam TRegistrations - Extension registration tuple type.
 */
export interface MigrateTagikonOptions<
	TShape extends AnyTagShape,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
> {
	readonly tagShape: TShape;
	readonly storageAdapter: StorageAdapterSetup<TagFromShape<TShape>>;
	readonly extensions?: TRegistrations;
}

/**
 * Result returned by {@link migrateTagikon}.
 * Pass `initializedAdapter` directly to {@link setupTagikon} as `storageAdapter`
 * to skip the second `initialize` call.
 *
 * @typeParam TTag - The concrete tag type derived from the tag shape.
 */
export interface MigrateTagikonResult<TTag extends Tag> {
	/**
	 * The storage adapter after `initialize` has been called.
	 * Pass this to `setupTagikon` instead of the original setup object.
	 */
	readonly initializedAdapter: StorageAdapter<TTag>;
}

const collectExtensionsWithMigration = (
	registrations: readonly ExtensionRegistration<symbol, ApiShape>[],
): AnyExtension[] => {
	const result: AnyExtension[] = [];
	for (const reg of registrations) {
		const ext = reg.extension;
		if (ext.migration) result.push(ext);
		if (ext.extensions) result.push(...collectExtensionsWithMigration(ext.extensions));
	}
	return result;
};

const validateMigrationSteps = (
	steps: readonly { readonly toVersion: number }[],
	stableId: string,
): void => {
	for (let index = 0; index < steps.length; index++) {
		const step = steps[index];
		if (!step || step.toVersion !== index + 1) {
			throw new InvalidExtensionMigrationError(
				stableId,
				`steps must be consecutive starting from 1, but step at index ${index} has toVersion ${step?.toVersion ?? "(missing)"}`,
			);
		}
	}
};

/**
 * Runs all pending extension data migrations against the given storage adapter,
 * then returns the initialized adapter ready to pass to {@link setupTagikon}.
 *
 * Call this **before** `setupTagikon`, passing the same `tagShape` and
 * `extensions`. The returned `initializedAdapter` replaces the raw setup
 * object in `setupTagikon`'s options.
 *
 * If the storage adapter implements {@link StorageAdapterWithMigrations},
 * `runStorageMigrations` is called first (before `initialize`), so
 * schema changes (e.g. new DB columns) land before any data migration runs.
 *
 * Each migration step is committed individually — if a step fails, the next
 * run resumes from the last successfully committed step.
 *
 * @throws {@link InvalidExtensionMigrationError} if an extension declares
 *   `migration` without a `namespace` symbol, or if its steps are not
 *   consecutive starting from 1.
 * @throws {@link ExtensionMigrationStepError} if a migration step's
 *   `migrate()` function throws. The original error is available via `cause`.
 *
 * @example
 * ```ts
 * const { initializedAdapter } = await migrateTagikon({
 *   tagShape,
 *   storageAdapter: new MapStorageAdapter(),
 *   extensions: [use(createHierarchy(), { permissions: ["tag:read", "tag:write"] })],
 * });
 *
 * const tagikon = setupTagikon({
 *   tagShape,
 *   storageAdapter: initializedAdapter,
 *   extensions: [use(createHierarchy(), { permissions: ["tag:read", "tag:write"] })],
 * });
 * ```
 */
export const migrateTagikon = async <
	TShape extends AnyTagShape,
	TRegistrations extends readonly ExtensionRegistration<symbol, ApiShape>[] = readonly [],
>(
	options: MigrateTagikonOptions<TShape, TRegistrations>,
): Promise<MigrateTagikonResult<TagFromShape<TShape>>> => {
	const { tagShape, storageAdapter, extensions = [] as unknown as TRegistrations } = options;

	// Step 1: run storage-level schema migrations before initialize, if supported.
	if ("runStorageMigrations" in storageAdapter) {
		await (storageAdapter as unknown as StorageAdapterWithMigrations).runStorageMigrations();
	}

	// Step 2: initialize the adapter.
	const adapter = storageAdapter.initialize(
		tagShape as unknown as Parameters<StorageAdapterSetup<TagFromShape<TShape>>["initialize"]>[0],
	);

	// Step 3: collect extensions that declare migrations.
	const migratingExtensions = collectExtensionsWithMigration(
		extensions as unknown as readonly ExtensionRegistration<symbol, ApiShape>[],
	);

	// Step 4: run pending migration steps for each extension.
	for (const ext of migratingExtensions) {
		const { migration } = ext;
		if (!migration) continue;

		const { stableId, steps } = migration;

		if (!ext.namespace) {
			throw new InvalidExtensionMigrationError(
				stableId,
				"migration requires a namespace symbol (the namespace is used as the AuxStore identity key)",
			);
		}

		validateMigrationSteps(steps, stableId);

		const currentVersion = (await adapter.getMigrationVersion(stableId)) ?? 0;
		const pendingSteps = steps.values().filter((s) => s.toVersion > currentVersion);

		const migrationContext = {
			aux: adapter.getAuxStore(ext.namespace),
			tags: {
				listAll: () => adapter.listTags(),
				update: (
					id: Parameters<StorageAdapter<TagFromShape<TShape>>["updateTag"]>[0],
					patch: Parameters<StorageAdapter<TagFromShape<TShape>>["updateTag"]>[1],
				) => adapter.updateTag(id, patch),
			},
		};

		for (const step of pendingSteps) {
			try {
				await step.migrate(
					migrationContext as unknown as Parameters<typeof step.migrate>[0],
				);
			} catch (cause) {
				throw new ExtensionMigrationStepError(stableId, step.toVersion, cause);
			}
			await adapter.setMigrationVersion(stableId, step.toVersion);
		}
	}

	return { initializedAdapter: adapter };
};
