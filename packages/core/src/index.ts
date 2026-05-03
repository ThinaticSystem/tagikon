export {
	ExtensionError,
	IllegalExtensionDefinitionError,
	NamespaceNotFoundError,
	ObjectNotTaggedError,
	TagAlreadyExistsError,
	TagNotFoundError,
	TagikonError,
} from "./core/errors.ts";
export { objectKey } from "./core/ids.ts";
export type { ObjectKey } from "./core/ids.ts";
export type { IdOf, Tag } from "./core/tag.ts";
export { setupTagikon } from "./factory.ts";
export type { CoreApi, SetupTagikonOptions } from "./factory.ts";
export {
	and,
	has,
	not,
	or,
	tagProperty,
	tagPropertyContains,
	tagPropertyEndsWith,
	tagPropertyGreaterThan,
	tagPropertyGreaterThanOrEqual,
	tagPropertyLessThan,
	tagPropertyLessThanOrEqual,
	tagPropertyStartsWith,
} from "./finder/condition.ts";
export type {
	AndCondition,
	HasCondition,
	NotCondition,
	OrCondition,
	TagCondition,
	TagPropertyCondition,
	TagPropertyContainsCondition,
	TagPropertyEndsWithCondition,
	TagPropertyEqualCondition,
	TagPropertyGreaterThanCondition,
	TagPropertyGreaterThanOrEqualCondition,
	TagPropertyLessThanCondition,
	TagPropertyLessThanOrEqualCondition,
	TagPropertyStartsWithCondition,
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
export type { ExtensionRegistration, UseOptions } from "./plugin/extension/use.ts";
export type { IdProvider } from "./plugin/id-provider/types.ts";
export type { AuxStore } from "./plugin/storage-adapter/aux-store.ts";
export type { StorageAdapter } from "./plugin/storage-adapter/types.ts";
export { PermissionDeniedError, PermissionMismatchError } from "./security/permission.ts";
export type { Permission, PermissionManifest } from "./security/permission.ts";
