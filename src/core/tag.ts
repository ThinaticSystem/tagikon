/**
 * Core tag entity.
 *
 * TKind — the kind string union. Defaults to `string` (maximally permissive).
 *   Plugins extend by passing a concrete union: Tag<TagKind | "category">.
 *   StorageAdapter / concrete code specifies Tag<TagKind, TagId> explicitly.
 *
 * TId — the ID type. Defaults to `unknown` (maximally permissive).
 *   An ID plugin can provide a different type (e.g. number for auto-increment).
 *
 * The defaults are intentionally permissive so that constraint sites can write
 * `T extends Tag` instead of `T extends Tag<string, unknown>`.
 * Concrete code always specifies Tag<TagKind, TagId> or a narrower variant.
 */
export interface Tag<TKind extends string = string, TId = unknown> {
	readonly id: TId;
	readonly name: string;
	readonly kind: TKind;
}

export type KindOf<TTag extends Tag> = TTag extends Tag<infer TKind, unknown> ? TKind : never;
export type IdOf<TTag extends Tag> = TTag extends Tag<string, infer TId> ? TId : never;
