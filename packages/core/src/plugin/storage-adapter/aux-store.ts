export interface AuxStore<TKey, TData> {
	find(key: TKey): Promise<null | TData>;
	put(key: TKey, data: TData): Promise<void>;
	patch(key: TKey, partial: Partial<TData>): Promise<null | TData>; // NOTE: ないときthrowじゃなくて良い？
	delete(key: TKey): Promise<boolean>;
	list(): Promise<[TKey, TData][]>;
}
