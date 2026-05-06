/**
 * Per-extension private key-value store. Each extension receives its own
 * isolated store keyed by tag ID; no other extension can read or write here.\
 * Used for extension-managed attributes that should not appear in the shared
 * tag shape (e.g. parent links, soft-delete flags managed by sub-namespaces).
 */
export interface AuxStore<TKey, TData> {
	/** @returns The stored data, or `null` if no entry exists for `key`. */
	find(key: TKey): Promise<null | TData>;

	/** Stores `data` for `key`, replacing any existing entry. */
	put(key: TKey, data: TData): Promise<void>;

	/**
	 * Merges `partial` into the existing entry.
	 *
	 * @returns The merged entry, or `null` if no entry existed before the call
	 *   (in which case nothing is written).
	 */
	patch(key: TKey, partial: Partial<TData>): Promise<null | TData>;

	/**
	 * Deletes the entry for `key`.
	 *
	 * @returns `true` if an entry was deleted, `false` if no entry existed
	 *   (no-op).
	 */
	delete(key: TKey): Promise<boolean>;

	/** @returns Every entry as `[key, data]` pairs. Order is not guaranteed. */
	list(): Promise<[TKey, TData][]>;
}
