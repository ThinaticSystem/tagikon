export interface Tag<TId = unknown> {
	readonly id: TId;
}

export type IdOf<TTag extends Tag> = TTag extends Tag<infer TId> ? TId : never;
