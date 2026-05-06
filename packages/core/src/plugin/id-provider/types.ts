import type { TagPropertyCodec } from "../storage-adapter/codec.ts";

export interface IdProvider<TId> extends TagPropertyCodec<TId, string> {
	/** Issue new ID */
	readonly generate: () => TId;
}
