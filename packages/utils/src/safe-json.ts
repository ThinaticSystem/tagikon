/** Keys that, if assigned via `[[Set]]`, trigger prototype-pollution in plain-object reducers. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const sanitize = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(sanitize);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.values()
				.filter(([key]) => !DANGEROUS_KEYS.has(key))
				.map(([key, val]) => [key, sanitize(val)]),
		);
	}
	return value;
};

/**
 * Parses a JSON string that is expected to be a plain object, stripping keys that could cause
 * prototype pollution when later spread or iterated via `Object.entries`. Sanitisation is applied
 * recursively to nested objects and arrays.
 *
 * Use instead of `JSON.parse` whenever the source is untrusted (e.g. data read from a database).
 */
export const safeJsonParse = <TResult extends Record<string, unknown>>(raw: string): TResult =>
	sanitize(JSON.parse(raw) as unknown) as TResult;

/**
 * Parses any JSON value, applying prototype-pollution sanitisation recursively to all plain objects
 * in the result — including those nested in arrays or other objects. Primitives are returned as-is.
 *
 * Use in codecs where the stored value type is not known at compile time.
 */
export const safeJsonParseValue = (raw: string): unknown => sanitize(JSON.parse(raw) as unknown);
