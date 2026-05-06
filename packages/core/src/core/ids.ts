declare const objectKeyBrand: unique symbol;

/**
 * Branded string used as the primary key of objects that tags are attached to.\
 * Use {@link objectKey} to create one — plain strings are not assignable here,
 * preventing accidental mix-ups with tag IDs (which are also commonly strings).
 */
export type ObjectKey = string & { readonly [objectKeyBrand]: never };

/**
 * Wraps a raw string as an {@link ObjectKey}. Performs no validation —\
 * the brand is purely a compile-time guard against passing arbitrary strings
 * where an object key is expected.
 *
 * @example
 * ```ts
 * import { objectKey } from "@tagikon/core";
 *
 * const memo1 = objectKey("memo-1");
 * await tagikon.tagObjects(urgent.id, [memo1]);
 * ```
 */
export const objectKey = (raw: string): ObjectKey => {
	return raw as ObjectKey;
};
