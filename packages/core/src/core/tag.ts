/**
 * Minimal tag entity. The library core only requires the `id` field —\
 * any other attribute (name, description, color, ...) is added by users
 * through intersection types or by extensions implementing the tag shape.
 *
 * The `TId` type parameter defaults to `unknown` for maximally permissive
 * generic constraints. In application code, use a concrete narrowing
 * such as `Tag<string>` or a branded type returned by an `IdProvider`.
 *
 * @example Minimal tag with name
 * ```ts
 * type MyTag = Tag<string> & { readonly name: string };
 *
 * const tagikon = setupTagikon<MyTag>({
 *   tagShape: { id: stringIdProvider(...), name: tpc.string() },
 *   storageAdapter: myAdapter,
 * });
 * ```
 */
export interface Tag<TId = unknown> {
	readonly id: TId;
}

/**
 * Extracts the ID type from a {@link Tag} subtype.\
 * Used throughout the API to keep `id`-typed parameters in sync with the
 * concrete tag shape without an extra type parameter on every signature.
 *
 * @example
 * ```ts
 * type MyTag = Tag<Uuid> & { readonly name: string };
 * type MyId = IdOf<MyTag>; // Uuid
 * ```
 */
export type IdOf<TTag extends Tag> = TTag extends Tag<infer TId> ? TId : never;
