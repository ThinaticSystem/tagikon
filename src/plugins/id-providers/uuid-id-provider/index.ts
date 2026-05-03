import type { IdProvider } from "../../../plugin/id-provider/types.ts";

import { stringIdProvider } from "../string-id-provider/index.ts";

declare const uuidBrand: unique symbol;
export type Uuid = string & { readonly [uuidBrand]: never };
export const uuid = (raw: string): Uuid => {
	return raw as Uuid;
};

export const UUID_ID_PROVIDER: IdProvider<Uuid> = stringIdProvider(() => uuid(crypto.randomUUID()));
