import type { TagId } from "../../../core/ids.ts";
import type { IdProvider } from "../../../plugin/id-provider/types.ts";

import { tagId } from "../../../core/ids.ts";
import { stringIdProvider } from "../string-id-provider/index.ts";

export const UUID_ID_PROVIDER: IdProvider<TagId> = stringIdProvider(() =>
	tagId(crypto.randomUUID()),
);
