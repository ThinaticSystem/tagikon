import type { Tag } from "../../core/tag.ts";
import type { ApiShape, Extension } from "./types.ts";

/**
 * Build an extension object. The same factory is used for individual extensions
 * and for parents that compose children via `extensions: [...]`.
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
