import type { Tag } from "../../core/tag.ts";
import type { ApiShape, Extension } from "./types.ts";

/**
 * Builds and freezes an {@link Extension} object.\
 * Use this for both leaf extensions and parents that compose children via
 * the `extensions: [...]` field.
 *
 * The returned object is `Object.freeze`d, so attempting to mutate hooks
 * or replace `api` after construction throws in strict mode.
 *
 * @example
 * ```ts
 * import { createExtension } from "@tagikon/core";
 *
 * const NS: unique symbol = Symbol("counter");
 *
 * const counter = createExtension<MyTag, typeof NS, { count: () => Promise<number> }>({
 *   namespace: NS,
 *   api: { async count(ctx) { return (await ctx.storage.listTags()).length; } },
 * });
 * ```
 */
export const createExtension = <
	TTag extends Tag,
	TNamespace extends symbol = never,
	TApi extends ApiShape = {},
	TAux = unknown,
	TChildrenApi extends ApiShape = {},
>(
	config: Extension<TTag, TNamespace, TApi, TAux, TChildrenApi>,
): Extension<TTag, TNamespace, TApi, TAux, TChildrenApi> => Object.freeze(config);
