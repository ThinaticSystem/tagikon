export { setupTagikon } from "./api/server.ts";
export type { CoreApi, SetupTagikonOptions } from "./api/server.ts";
export {
	ObjectNotTaggedError,
	TagAlreadyExistsError,
	TagNotFoundError,
	TagikonError,
} from "./core/errors.ts";
export { objectKey, tagId } from "./core/ids.ts";
export type { ObjectKey, TagId } from "./core/ids.ts";
export type { TagRelation } from "./core/relation.ts";
export type { IdOf, Tag } from "./core/tag.ts";
export { and, has, not, or, tagProperty } from "./finder/condition.ts";
export type {
	AndCondition,
	HasCondition,
	NotCondition,
	OrCondition,
	TagCondition,
	TagPropertyCondition,
} from "./finder/condition.ts";
export { MemoryFinder } from "./finder/memory-finder.ts";
export type {
	AfterFn,
	HookPhases,
	TapRawFn,
	TapTransformedFn,
	TransformFn,
	TransformOutputFn,
} from "./hook/types.ts";
export { createExtensionContext } from "./plugin/extension/context.ts";
export type { ExtensionContext, ExtensionStorageView } from "./plugin/extension/context.ts";
export { createExtension } from "./plugin/extension/factory.ts";
export type {
	AddTagInput,
	ApiShape,
	ChildrenApiOf,
	EditTagInput,
	Extension,
	FindObjectsByTagsInput,
	FinderImplement,
	ListTagsInput,
	RemoveTagInput,
	ResetWithTagsInput,
	TagObjectsInput,
	UntagObjectsInput,
} from "./plugin/extension/types.ts";
export { use } from "./plugin/extension/use.ts";
export type { ExtensionRegistration } from "./plugin/extension/use.ts";
export type { IdProvider } from "./plugin/id-provider/types.ts";
export type { AuxStore } from "./plugin/storage-adapter/aux-store.ts";
export type { StorageAdapter } from "./plugin/storage-adapter/types.ts";
export { createDefaultAttributes } from "./plugins/extensions/default-attributes/index.ts";
export type { AttributeProviders } from "./plugins/extensions/default-attributes/index.ts";
export { SOFT_DELETE_NS, createSoftDelete } from "./plugins/extensions/soft-delete/index.ts";
export type { SoftDeleteApi, TagWithSoftDelete } from "./plugins/extensions/soft-delete/index.ts";
export * as idProviders from "./plugins/id-providers/index.ts";
export { stringIdProvider } from "./plugins/id-providers/string-id-provider/index.ts";
export { UUID_ID_PROVIDER } from "./plugins/id-providers/uuid-id-provider/index.ts";
export { MapStorageAdapter } from "./plugins/storage-adapters/map-storage-adapter/index.ts";
export { PermissionMismatchError } from "./security/permission.ts";
export type { Permission, PermissionManifest } from "./security/permission.ts";
