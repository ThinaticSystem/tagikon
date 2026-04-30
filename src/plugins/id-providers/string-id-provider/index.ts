import type { IdProvider } from "../../../plugin/id-provider/types.ts";

/** An ID provider that treats string values as IDs directly. */
export const stringIdProvider = <TId extends string>(generate: () => TId): IdProvider<TId> => ({
	generate,
	serialize: (id) => id,
	deserialize: (raw) => raw as TId,
});
