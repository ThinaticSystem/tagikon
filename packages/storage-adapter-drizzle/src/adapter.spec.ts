import type { Tag } from "@tagikon/core";
import type { StorageAdapterTestTag } from "@tagikon/core/testing";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { createClient } from "@libsql/client";
import {
	objectKey,
	propertyEqual,
	propertyGreaterThan,
	taggedWithAny,
	tagsWhere,
	tpc,
} from "@tagikon/core";
import { runStorageAdapterTests, testIdProvider } from "@tagikon/core/testing";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { drizzle } from "drizzle-orm/libsql";
import { expect, suite, test } from "vitest";

import { DrizzleStorageAdapter } from "./adapter.ts";
import { createTagikonSqliteSchema } from "./schema.ts";

const createSqliteDb = async () => {
	const client = createClient({ url: ":memory:" });
	await client.execute("CREATE TABLE tagikon_tags (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
	await client.execute(
		"CREATE TABLE tagikon_relations (tag_id TEXT NOT NULL, object_key TEXT NOT NULL, PRIMARY KEY (tag_id, object_key))",
	);
	await client.execute(
		"CREATE TABLE tagikon_aux (extension_key TEXT NOT NULL, tag_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (extension_key, tag_id))",
	);
	return { client, db: drizzle(client), schema: createTagikonSqliteSchema() };
};

const createAdapter = async () => {
	const { db, schema } = await createSqliteDb();
	return new DrizzleStorageAdapter<StorageAdapterTestTag>(db, schema).initialize({
		id: testIdProvider,
	});
};

runStorageAdapterTests("DrizzleStorageAdapter", createAdapter);

suite("DrizzleStorageAdapter – codec round-trips", () => {
	const makeAdapterWithBigint = async () => {
		const { db, schema } = await createSqliteDb();
		type TagWithAmount = Tag<Uuid> & { readonly amount: bigint };
		return new DrizzleStorageAdapter<TagWithAmount>(db, schema).initialize({
			id: UUID_ID_PROVIDER,
			amount: tpc.bigint(),
		});
	};

	test("bigint tag property survives createTag → getTag round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		const tag = await adapter.createTag({ amount: 1_000_000_000_000n });
		const result = await adapter.getTag(tag.id);
		expect(result!.amount).toBe(1_000_000_000_000n);
		expect(typeof result!.amount).toBe("bigint");
	});

	test("bigint tag property survives updateTag → getTag round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		const tag = await adapter.createTag({ amount: 1n });
		await adapter.updateTag(tag.id, { amount: 9999n });
		const result = await adapter.getTag(tag.id);
		expect(result!.amount).toBe(9999n);
	});

	test("bigint tag property survives listTags round-trip", async () => {
		const adapter = await makeAdapterWithBigint();
		await adapter.createTag({ amount: 42n });
		await adapter.createTag({ amount: 100n });
		const result = await adapter.listTags();
		expect(result).toHaveLength(2);
		expect(result.every((t) => typeof t.amount === "bigint")).toBe(true);
	});

	test("propertyEqual with bigint value queries correctly", async () => {
		const adapter = await makeAdapterWithBigint();
		const t1 = await adapter.createTag({ amount: 1000n });
		const t2 = await adapter.createTag({ amount: 2000n });
		await adapter.addRelations(t1.id, [objectKey("obj1")]);
		await adapter.addRelations(t2.id, [objectKey("obj2")]);
		const result = await adapter.findObjects(
			taggedWithAny(tagsWhere(propertyEqual("amount", 1000n))),
		);
		expect(result).toEqual([objectKey("obj1")]);
	});

	test("aux store with custom AuxCodec round-trips data", async () => {
		const adapter = await createAdapter();
		const EXT = Symbol("custom-codec-ext");
		const store = adapter.getAuxStore<{ count: number }>(EXT, {
			serialize: (data) => JSON.stringify(data),
			deserialize: (raw) => JSON.parse(raw) as { count: number },
		});
		const tag = await adapter.createTag({ name: "x" });
		await store.put(tag.id, { count: 99 });
		expect(await store.find(tag.id)).toEqual({ count: 99 });
	});
});

suite("DrizzleStorageAdapter – numeric tagsWhere predicates", () => {
	const makeAdapterWithScore = async () => {
		const { client, db, schema } = await createSqliteDb();
		type TagWithScore = Tag<Uuid> & { score: number };
		return {
			client,
			adapter: new DrizzleStorageAdapter<TagWithScore>(db, schema).initialize({
				id: UUID_ID_PROVIDER,
			}),
		};
	};

	test("propertyGreaterThan numeric predicate filters correctly", async () => {
		const { adapter } = await makeAdapterWithScore();
		const t1 = await adapter.createTag({ score: 1 });
		const t5 = await adapter.createTag({ score: 5 });
		const t10 = await adapter.createTag({ score: 10 });
		await adapter.addRelations(t1.id, [objectKey("obj-1")]);
		await adapter.addRelations(t5.id, [objectKey("obj-5")]);
		await adapter.addRelations(t10.id, [objectKey("obj-10")]);
		const result = await adapter.findObjects(
			taggedWithAny(tagsWhere(propertyGreaterThan("score", 4))),
		);
		expect(result.sort()).toEqual([objectKey("obj-5"), objectKey("obj-10")].sort());
	});
});

suite("DrizzleStorageAdapter – prototype pollution safety", () => {
	test("__proto__ key in stored tag data does not pollute Object prototype", async () => {
		const { client, db, schema } = await createSqliteDb();
		const adapter = new DrizzleStorageAdapter<StorageAdapterTestTag>(db, schema).initialize({
			id: testIdProvider,
		});
		const tag = await adapter.createTag({ name: "safe" });

		// Manually inject a poisoned row to simulate attacker-controlled storage
		await client.execute({
			sql: `UPDATE tagikon_tags SET data = ? WHERE id = ?`,
			args: [`{"name":"safe","__proto__":{"poisoned":true}}`, tag.id as string],
		});

		const result = await adapter.getTag(tag.id);
		expect(result).not.toBeNull();
		expect((Object.prototype as Record<string, unknown>)["poisoned"]).toBeUndefined();
	});
});
