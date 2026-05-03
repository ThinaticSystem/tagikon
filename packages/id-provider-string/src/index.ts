import type { IdProvider } from "@tagikon/core";

/** An ID provider that treats string values as IDs directly. */
export const stringIdProvider = <TId extends string>(generate: () => TId): IdProvider<TId> => ({
	generate,
	serialize: (id) => id,
	deserialize: (raw) => raw as TId,
});
