import type { IdOf, Tag } from "../../core/tag.ts";

export type JsonPrimitive = string | number | boolean | null;

export interface TagPropertyCodec<TValue, TStored extends JsonPrimitive = JsonPrimitive> {
	readonly serialize: (value: TValue) => TStored;
	readonly deserialize: (raw: TStored) => TValue;
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
	// biome-ignore lint/suspicious/noExplicitAny: TStored can be any JsonPrimitive subtype (e.g. string for tpc.bigint())
	readonly [TKey in keyof Omit<TTag, "id">]?: TagPropertyCodec<Omit<TTag, "id">[TKey], any>;
};

// Loose constraint for TagFromShape — 'any' in serialize is required so that concrete
// IdProvider<X> types (e.g. IdProvider<Uuid>) satisfy the constraint despite contravariance.
// biome-ignore lint/suspicious/noExplicitAny: necessary to accept any concrete IdProvider<X>
type AnyTagShapeConstraint = {
	readonly id: {
		readonly generate: () => unknown;
		readonly serialize: (value: any) => string;
		readonly deserialize: (raw: string) => unknown;
	};
};

export type TagFromShape<TShape extends AnyTagShapeConstraint> = {
	// IdProvider-shaped entries (have 'generate') → infer the id type from generate's return.
	// Codec-shaped entries (have 'serialize' but no 'generate') → infer the value type.
	readonly [TKey in keyof TShape]: TShape[TKey] extends {
		readonly generate: () => infer TId;
		// biome-ignore lint/suspicious/noExplicitAny: matches any concrete IdProvider serialize
		readonly serialize: (value: any) => string;
	}
		? TId
		: TShape[TKey] extends { readonly serialize: (value: infer TValue) => JsonPrimitive }
			? TValue
			: never;
};

export const tpc = {
	string: (): TagPropertyCodec<string, string> => ({
		serialize: (v) => v,
		deserialize: (v) => v,
	}),
	number: (): TagPropertyCodec<number, number> => ({
		serialize: (v) => v,
		deserialize: (v) => v,
	}),
	boolean: (): TagPropertyCodec<boolean, boolean> => ({
		serialize: (v) => v,
		deserialize: (v) => v,
	}),
	bigint: (): TagPropertyCodec<bigint, string> => ({
		serialize: (v) => String(v),
		deserialize: (v) => BigInt(v),
	}),
	json: <TValue>(): TagPropertyCodec<TValue, string> => ({
		serialize: (v) => JSON.stringify(v),
		deserialize: (v) => JSON.parse(v) as TValue,
	}),
} satisfies Record<string, () => TagPropertyCodec<any, any>>;
