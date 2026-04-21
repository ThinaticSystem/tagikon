export const TAG_KIND = {
	USER: "user",
	SYSTEM: "system",
} as const satisfies Record<string, string>;

export type TagKind = (typeof TAG_KIND)[keyof typeof TAG_KIND];
