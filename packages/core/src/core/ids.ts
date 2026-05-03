declare const objectKeyBrand: unique symbol;
export type ObjectKey = string & { readonly [objectKeyBrand]: never };
export const objectKey = (raw: string): ObjectKey => {
	return raw as ObjectKey;
};
