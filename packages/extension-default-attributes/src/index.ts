import type { Extension, Tag } from "@tagikon/core";

/**
 * Map of attribute names to default-value provider functions.\
 * Each key must be a non-`id` attribute of the tag type. When `addTag` is
 * called without a value for one of these keys, the provider is invoked
 * to fill it in.
 *
 * @typeParam TTag - The tag type.
 *
 * @example
 * ```ts
 * const providers: AttributeProviders<MyTag> = {
 *   createdAt: () => new Date(),
 *   color: () => "gray",
 * };
 * ```
 */
export type AttributeProviders<TTag extends Tag> = {
	readonly [TKey in keyof Omit<TTag, "id">]?: () => Omit<TTag, "id">[TKey];
};

/**
 * Builds an {@link Extension} that fills missing tag attributes via
 * default-value provider functions during `addTag`.\
 * Attributes already supplied by the caller are left untouched — the
 * extension only fills gaps.
 *
 * Plays well with `tpc.xxx().optional()` codecs: declare an attribute
 * optional in the tag shape so callers may omit it, then have this
 * extension supply a default.
 *
 * @example
 * ```ts
 * import { createDefaultAttributes } from "@tagikon/extension-default-attributes";
 * import { setupTagikon, tpc, use } from "@tagikon/core";
 *
 * const tagShape = {
 *   id: UUID_ID_PROVIDER,
 *   name: tpc.string(),
 *   createdAt: tpc.string(),
 * };
 *
 * const defaults = createDefaultAttributes<TagFromShape<typeof tagShape>>({
 *   createdAt: () => new Date().toISOString(),
 * });
 *
 * const tagikon = setupTagikon({
 *   tagShape,
 *   storageAdapter,
 *   extensions: [use(defaults)],
 * });
 *
 * await tagikon.addTag({ name: "urgent" }); // createdAt is filled in automatically
 * ```
 */
export const createDefaultAttributes = <TTag extends Tag>(
	providers: AttributeProviders<TTag>,
): Extension<TTag> => ({
	hooks: {
		addTag: {
			transform: (_ctx, input) => {
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
