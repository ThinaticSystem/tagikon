import type { IdProvider } from "@tagikon/core";

/**
 * Builds an {@link IdProvider} for string-shaped IDs.\
 * `serialize` / `deserialize` are identity — `generate` is supplied by the
 * caller and decides the actual ID format (sequential, branded, etc.).
 *
 * @param generate - Function called once per `addTag` to produce a fresh
 *   ID. Must return a unique value on each call; callers are responsible
 *   for collision avoidance.
 *
 * @example Sequential IDs
 * ```ts
 * import { stringIdProvider } from "@tagikon/id-provider-string";
 *
 * let n = 0;
 * const sequentialIds = stringIdProvider<`id-${number}`>(() => `id-${n++}`);
 * ```
 *
 * @example UUID via id-provider-uuid
 * ```ts
 * // @tagikon/id-provider-uuid is implemented as:
 * // export const UUID_ID_PROVIDER = stringIdProvider(() => uuid(crypto.randomUUID()));
 * ```
 */
export const stringIdProvider = <TId extends string>(generate: () => TId): IdProvider<TId> => ({
	generate,
	serialize: (id) => id,
	deserialize: (raw) => raw as TId,
});
