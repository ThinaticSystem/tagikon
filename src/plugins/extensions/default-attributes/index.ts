import type { Tag } from "../../../core/tag.ts";
import type { Extension } from "../../../plugin/extension/types.ts";

export type AttributeProviders<TTag extends Tag> = {
	readonly [TKey in keyof Omit<TTag, "id">]?: () => Omit<TTag, "id">[TKey];
};

export const createDefaultAttributes = <TTag extends Tag>(
	providers: AttributeProviders<TTag>,
): Extension<TTag> => ({
	hooks: {
		addTag: {
			transform: (input) => {
				const result: Record<string, unknown> = { ...input };
				for (const key of Object.keys(providers)) {
					if (!(key in result)) {
						const provider = providers[key as keyof typeof providers];
						if (provider) result[key] = provider();
					}
				}
				return result as Omit<TTag, "id">;
			},
		},
	},
});
