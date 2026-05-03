export interface IdProvider<TId> {
	/** Issue new ID */
	readonly generate: () => TId;
	/** Convert ID to string */
	readonly serialize: (id: TId) => string;
	/** Convert string to ID */
	readonly deserialize: (raw: string) => TId;
}
