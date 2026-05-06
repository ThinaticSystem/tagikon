import type { IdOf, Tag } from "../../core/tag.ts";

export type JsonPrimitive = string | number | boolean | null;

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

export interface AuxCodec<TData> {
	readonly serialize: (data: TData) => string;
	readonly deserialize: (raw: string) => TData;
}

// Structural shape of IdProvider — avoids importing id-provider/types.ts to prevent circular deps.
// IdProvider<TId> formally extends TagPropertyCodec<TId, string> and adds generate.
type IdProviderShape<TId> = TagPropertyCodec<TId, string> & {
	readonly generate: () => TId;
};

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
			(v) => JSON.parse(v) as TValue,
		),
} satisfies Record<string, () => TagPropertyCodec<any, any>>;
