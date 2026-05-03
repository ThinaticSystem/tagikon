import type { IdProvider } from "@tagikon/core";

import { stringIdProvider } from "@tagikon/id-provider-string";

declare const uuidBrand: unique symbol;
export type Uuid = string & { readonly [uuidBrand]: never };
export const uuid = (raw: string): Uuid => {
	return raw as Uuid;
};

export const UUID_ID_PROVIDER: IdProvider<Uuid> = stringIdProvider(() => uuid(crypto.randomUUID()));
