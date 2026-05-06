import type { IdProvider } from "@tagikon/core";

import { stringIdProvider } from "@tagikon/id-provider-string";

declare const uuidBrand: unique symbol;

/**
 * Branded `string` type for UUID v4 values.\
 * The brand prevents arbitrary strings from being passed where a UUID
 * is expected. Use {@link uuid} to construct values.
 */
export type Uuid = string & { readonly [uuidBrand]: never };

/**
 * Wraps a raw string as a {@link Uuid} without validation.\
 * Use when round-tripping through storage (raw strings come back from the
 * DB) or when you have produced a UUID by some other means and want to
 * carry the brand.
 */
export const uuid = (raw: string): Uuid => {
	return raw as Uuid;
};

/**
 * Default {@link IdProvider} for UUID v4 IDs.\
 * Backed by `crypto.randomUUID()`, available on Node 19+ and modern
 * browsers; in older environments install a polyfill before importing.
 *
 * @example
 * ```ts
 * import { setupTagikon, tpc } from "@tagikon/core";
 * import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
 *
 * const tagikon = setupTagikon({
 *   tagShape: { id: UUID_ID_PROVIDER, name: tpc.string() },
 *   storageAdapter: myAdapter,
 * });
 * ```
 */
export const UUID_ID_PROVIDER: IdProvider<Uuid> = stringIdProvider(() => uuid(crypto.randomUUID()));
