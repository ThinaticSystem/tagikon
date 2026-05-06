import type { IdOf, Tag } from "../../core/tag.ts";

import { safeJsonParseValue } from "./safe-json.ts";

/**
 * The set of primitive shapes a tag property can be serialized to.\
 * Stored representation is always one of these, so adapters can map it
 * directly to common storage layers (SQL columns, JSON, etc.).
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Bidirectional codec for a single tag property.\
 * `serialize` runs before persistence; `deserialize` runs on read.\
 * Use {@link tpc} for the built-ins (string / number / boolean / bigint / json),
 * or {@link makeCodec} to define custom ones (e.g. `Date` ↔ ISO string).
 *
 * @typeParam TValue - The runtime value type (what your code sees).
 * @typeParam TStored - The persisted shape (a {@link JsonPrimitive}).
 */
export interface TagPropertyCodec<TValue, TStored extends JsonPrimitive = JsonPrimitive> {
	readonly serialize: (value: TValue) => TStored;
	readonly deserialize: (raw: TStored) => TValue;
}

/**
 * A {@link TagPropertyCodec} variant that marks the property as optional in the tag shape.
 * Use {@link tpc} factory methods with `.optional()` chaining to create instances.
 * When placed in a tag shape, `TagFromShape` will produce an optional property (`?: TValue`).
 */
export interface OptionalTagPropertyCodec<
	TValue,
	TStored extends JsonPrimitive = JsonPrimitive,
> extends TagPropertyCodec<TValue, TStored> {
	readonly _optional: true;
	readonly optional: () => OptionalTagPropertyCodec<TValue, TStored>;
}

/**
 * Codec used by adapters to serialize an extension's auxiliary data
 * to a single string value before storage.\
 * Pass into {@link StorageAdapter.getAuxStore} to override the adapter's
 * default (typically JSON).
 */
export interface AuxCodec<TData> {
	readonly serialize: (data: TData) => string;
	readonly deserialize: (raw: string) => TData;
}

// Structural shape of IdProvider — avoids importing id-provider/types.ts to prevent circular deps.
// IdProvider<TId> formally extends TagPropertyCodec<TId, string> and adds generate.
type IdProviderShape<TId> = TagPropertyCodec<TId, string> & {
	readonly generate: () => TId;
};

/**
 * The shape passed to {@link setupTagikon}. Describes how each tag
 * property is serialized for storage.
 *
 * - `id` — must be an {@link IdProvider} (a codec plus `generate()`).
 * - other properties — {@link TagPropertyCodec} or {@link OptionalTagPropertyCodec}
 *   (built with {@link tpc}). Optional codecs cause the inferred tag type
 *   to mark the property optional.
 *
 * @example
 * ```ts
 * import { tpc } from "@tagikon/core";
 * import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
 *
 * const tagShape = {
 *   id: UUID_ID_PROVIDER,
 *   name: tpc.string(),
 *   description: tpc.string().optional(),
 *   priority: tpc.number(),
 * } as const;
 * ```
 */
export type TagShape<TTag extends Tag> = {
	readonly id: IdProviderShape<IdOf<TTag>>;
} & {
	// NonNullable<...> strips undefined from optional TTag properties (their indexed-access type includes undefined).
	readonly [TKey in keyof Omit<TTag, "id">]?: TagPropertyCodec<
		NonNullable<Omit<TTag, "id">[TKey]>,
		any
	>;
};

// Loose constraint for TagFromShape — 'any' in serialize is required so that concrete
// IdProvider<X> types (e.g. IdProvider<Uuid>) satisfy the constraint despite contravariance.
type AnyTagShapeConstraint = {
	readonly id: {
		readonly generate: () => unknown;
		readonly serialize: (value: any) => string;
		readonly deserialize: (raw: string) => unknown;
	};
};

/** IdProvider-shaped entries → TId from generate(); codec-shaped entries → TValue from serialize(). */
type InferShapeEntryValue<TEntry> = TEntry extends {
	readonly generate: () => infer TId;
	readonly serialize: (value: any) => string;
}
	? TId
	: TEntry extends { readonly serialize: (value: infer TValue) => JsonPrimitive }
		? TValue
		: never;

/**
 * Infers the concrete tag type from a `TagShape`. Used internally by
 * {@link setupTagikon} so callers do not need to specify the tag type
 * twice (once as a generic, once as the shape).
 *
 * - `id` is inferred from the IdProvider's `generate()` return type.
 * - Required codec entries become required properties.
 * - `.optional()` codec entries become optional properties.
 *
 * @example
 * ```ts
 * const tagShape = {
 *   id: UUID_ID_PROVIDER,
 *   name: tpc.string(),
 *   description: tpc.string().optional(),
 * } as const;
 *
 * type MyTag = TagFromShape<typeof tagShape>;
 * // { readonly id: Uuid; readonly name: string; readonly description?: string }
 * ```
 */
// `id` is extracted separately so TypeScript can prove `TagFromShape<TShape> extends Tag` at the
// constraint site — a plain intersection of two mapped types hides `id` from the checker.
export type TagFromShape<TShape extends AnyTagShapeConstraint> = {
	readonly id: InferShapeEntryValue<TShape["id"]>;
} & {
	// Non-id, non-optional codec entries → required properties.
	readonly [TKey in Exclude<keyof TShape, "id"> as TShape[TKey] extends { readonly _optional: true }
		? never
		: TKey]: InferShapeEntryValue<TShape[TKey]>;
} & {
	// Non-id optional codec entries (_optional: true) → optional properties.
	readonly [TKey in Exclude<keyof TShape, "id"> as TShape[TKey] extends { readonly _optional: true }
		? TKey
		: never]?: InferShapeEntryValue<TShape[TKey]>;
};

// Internal type for values returned by tpc factory methods — TagPropertyCodec extended with
// an optional() chain that produces an OptionalTagPropertyCodec.
type TpcResult<TValue, TStored extends JsonPrimitive> = TagPropertyCodec<TValue, TStored> & {
	readonly optional: () => OptionalTagPropertyCodec<TValue, TStored>;
};

/**
 * Builds a {@link TagPropertyCodec} from a serialize/deserialize pair.\
 * The returned codec carries an `.optional()` chain — call it to mark the
 * property optional in the inferred tag type.
 *
 * @example Date codec
 * ```ts
 * import { makeCodec } from "@tagikon/core";
 *
 * const dateCodec = makeCodec<Date, string>(
 *   (d) => d.toISOString(),
 *   (s) => new Date(s),
 * );
 *
 * const tagShape = {
 *   id: UUID_ID_PROVIDER,
 *   createdAt: dateCodec,
 *   updatedAt: dateCodec.optional(),
 * };
 * ```
 */
export const makeCodec = <TValue, TStored extends JsonPrimitive>(
	serialize: (value: TValue) => TStored,
	deserialize: (raw: TStored) => TValue,
): TpcResult<TValue, TStored> => {
	const optionalCodec: OptionalTagPropertyCodec<TValue, TStored> = {
		serialize,
		deserialize,
		_optional: true,
		optional: () => optionalCodec,
	};
	return { serialize, deserialize, optional: () => optionalCodec };
};

/**
 * Built-in {@link TagPropertyCodec} factories for the common primitive types.\
 * Each factory returns a fresh codec with an `.optional()` chain.
 *
 * | factory          | runtime  | stored                                        |
 * | ---------------- | -------- | --------------------------------------------- |
 * | `tpc.string()`   | `string` | `string` (identity)                           |
 * | `tpc.number()`   | `number` | `number` (identity)                           |
 * | `tpc.boolean()`  | `boolean`| `boolean` (identity)                          |
 * | `tpc.bigint()`   | `bigint` | `string` (decimal)                            |
 * | `tpc.json<T>()`  | `T`      | `string` (JSON, parsed via `safeJsonParseValue`) |
 *
 * @example
 * ```ts
 * import { tpc } from "@tagikon/core";
 *
 * const tagShape = {
 *   id: UUID_ID_PROVIDER,
 *   name: tpc.string(),
 *   priority: tpc.number(),
 *   metadata: tpc.json<{ owner: string }>().optional(),
 * };
 * ```
 */
export const tpc = {
	string: (): TpcResult<string, string> =>
		makeCodec(
			(v) => v,
			(v) => v,
		),
	number: (): TpcResult<number, number> =>
		makeCodec(
			(v) => v,
			(v) => v,
		),
	boolean: (): TpcResult<boolean, boolean> =>
		makeCodec(
			(v) => v,
			(v) => v,
		),
	bigint: (): TpcResult<bigint, string> =>
		makeCodec(
			(v) => String(v),
			(v) => BigInt(v),
		),
	json: <TValue>(): TpcResult<TValue, string> =>
		makeCodec(
			(v) => JSON.stringify(v),
			(v) => safeJsonParseValue(v) as TValue,
		),
} satisfies Record<string, () => TagPropertyCodec<any, any>>;
