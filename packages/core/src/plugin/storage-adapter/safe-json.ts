/** Keys that, if assigned via `[[Set]]`, trigger prototype-pollution in plain-object reducers. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const filterObjectEntries = (obj: Record<string, unknown>): Record<string, unknown> =>
	Object.fromEntries(Object.entries(obj).filter(([key]) => !DANGEROUS_KEYS.has(key)));

/**
 * Parses a JSON string that is expected to be a plain object, stripping keys that could cause
 * prototype pollution when later spread or iterated via `Object.entries`.
 *
 * Use instead of `JSON.parse` whenever the source is untrusted (e.g. data read from a database).
 */
export const safeJsonParse = <TResult extends Record<string, unknown>>(raw: string): TResult =>
	filterObjectEntries(JSON.parse(raw) as Record<string, unknown>) as TResult;

/**
 * Parses any JSON value, applying {@link safeJsonParse} sanitisation when the result is a plain
 * object. Primitives and arrays are returned as-is.
 *
 * Use in codecs where the stored value type is not known at compile time.
 */
export const safeJsonParseValue = (raw: string): unknown => {
	const parsed = JSON.parse(raw) as unknown;
	if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
		return filterObjectEntries(parsed as Record<string, unknown>);
	}
	return parsed;
};
