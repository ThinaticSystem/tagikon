export {
	ExtensionError,
	IllegalExtensionDefinitionError,
	NamespaceNotFoundError,
	ObjectNotTaggedError,
	RequiredPropertyMissingError,
	StorageAdapterAlreadyInitializedError,
	StorageAdapterNotInitializedError,
	TagAlreadyExistsError,
	TagNotFoundError,
	TagikonError,
} from "./core/errors.ts";
export { objectKey } from "./core/ids.ts";
export type { ObjectKey } from "./core/ids.ts";
export type { IdOf, Tag } from "./core/tag.ts";
export { setupTagikon } from "./factory.ts";
export type { CoreApi, SetupTagikonOptions } from "./factory.ts";
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
	CountObjectsInput,
	EditTagInput,
	Extension,
	FindObjectsInput,
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
export { makeCodec, tpc } from "./plugin/storage-adapter/codec.ts";
export type {
	AuxCodec,
	JsonPrimitive,
	OptionalTagPropertyCodec,
	TagFromShape,
	TagPropertyCodec,
	TagShape,
} from "./plugin/storage-adapter/codec.ts";
export type { StorageAdapter, StorageAdapterSetup } from "./plugin/storage-adapter/types.ts";
export {
	and,
	complementTags,
	intersectTags,
	not,
	or,
	predicateAnd,
	predicateNot,
	predicateOr,
	propertyContains,
	propertyEndsWith,
	propertyEqual,
	propertyGreaterThan,
	propertyGreaterThanOrEqual,
	propertyLessThan,
	propertyLessThanOrEqual,
	propertyStartsWith,
	taggedWithAll,
	taggedWithAny,
	tagsById,
	tagsWhere,
	unionTags,
} from "./query/builders.ts";
export {
	countObjectQueryInMemory,
	evaluateObjectQueryInMemory,
	evaluateTagSelectorAgainstTags,
} from "./query/evaluator.ts";
export type {
	AndObjectQuery,
	FindObjectsOptions,
	NotObjectQuery,
	ObjectQuery,
	OrObjectQuery,
	TagPredicate,
	TagPredicateAnd,
	TagPredicateLogicalOperator,
	TagPredicateNot,
	TagPredicateOr,
	TagPropertyContainsPredicate,
	TagPropertyEndsWithPredicate,
	TagPropertyEqualPredicate,
	TagPropertyGreaterThanOrEqualPredicate,
	TagPropertyGreaterThanPredicate,
	TagPropertyLessThanOrEqualPredicate,
	TagPropertyLessThanPredicate,
	TagPropertyPredicate,
	TagPropertyStartsWithPredicate,
	TagSelector,
	TaggedWithAllQuery,
	TaggedWithAnyQuery,
	TagsByIdSelector,
	TagsComplementSelector,
	TagsIntersectionSelector,
	TagsUnionSelector,
	TagsWhereSelector,
} from "./query/types.ts";
export { PermissionDeniedError, PermissionMismatchError } from "./security/permission.ts";
export type { Permission, PermissionManifest } from "./security/permission.ts";
