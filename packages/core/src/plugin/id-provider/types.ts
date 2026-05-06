import type { TagPropertyCodec } from "../storage-adapter/codec.ts";

/**
 * Generates and (de)serializes tag IDs.\
 * Extends {@link TagPropertyCodec} with `serialize` returning a `string`,
 * so storage adapters can rely on a string primary key column regardless
 * of the runtime ID type (UUID, branded string, opaque token, etc.).
 *
 * Implementations live in dedicated packages — see
 * `@tagikon/id-provider-string` and `@tagikon/id-provider-uuid`.
 *
 * @typeParam TId - The runtime ID type. Often a branded `string` such as
 *   `Uuid`; can also be a plain `string` or any other type whose values
 *   round-trip through string serialization.
 *
 * @example
 * ```ts
 * import { stringIdProvider } from "@tagikon/id-provider-string";
 *
 * type SequentialId = `id-${number}`;
 *
 * let counter = 0;
 * const provider = stringIdProvider<SequentialId>(
 *   () => `id-${counter++}` as SequentialId,
 * );
 * ```
 */
export interface IdProvider<TId> extends TagPropertyCodec<TId, string> {
	/** Issues a fresh ID. Must produce a unique value on each call. */
	readonly generate: () => TId;
}
