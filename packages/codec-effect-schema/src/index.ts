import type { JsonPrimitive } from "@tagikon/core";
import type { Schema } from "effect/Schema";

import { makeCodec } from "@tagikon/core";
import { decodeUnknownSync, encodeSync } from "effect/Schema";

/**
 * Creates a {@link import("@tagikon/core").TagPropertyCodec} from an Effect Schema.
 *
 * The schema's `encodeSync` is used as `serialize` and `decodeUnknownSync` as `deserialize`.\
 * Decode errors throw Effect's `ParseError` — the same error you would get calling\
 * `Schema.decodeUnknownSync` directly.
 *
 * The schema must have no requirements (`R = never`) so that sync operations are safe.
 *
 * The returned codec supports `.optional()` chaining, making it usable as an optional property\
 * in a tag shape passed to `setupTagikon`.
 *
 * @example
 * ```ts
 * import { fromEffectSchema } from "@tagikon/codec-effect-schema";
 * import { Schema } from "effect";
 * import { setupTagikon, tpc } from "@tagikon/core";
 * import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
 *
 * // Validates that the string is non-empty on deserialization
 * const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
 *
 * const tagikon = setupTagikon({
 *   tagShape: {
 *     id: UUID_ID_PROVIDER,
 *     name: fromEffectSchema(NonEmptyString),
 *     description: fromEffectSchema(Schema.String).optional(),
 *   },
 *   storageAdapter: myAdapter,
 * });
 * ```
 *
 * @param schema - An Effect Schema with no context requirements.
 */
export const fromEffectSchema = <TValue, TStored extends JsonPrimitive>(
	schema: Schema<TValue, TStored, never>,
) =>
	makeCodec<TValue, TStored>(
		(value) => encodeSync(schema)(value),
		(raw) => decodeUnknownSync(schema)(raw),
	);
