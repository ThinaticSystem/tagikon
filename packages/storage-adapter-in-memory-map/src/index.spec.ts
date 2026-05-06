import type { IdProvider, Tag } from "@tagikon/core";
import type { StorageAdapterTestTag } from "@tagikon/core/testing";

import { objectKey } from "@tagikon/core";
import { runStorageAdapterTests, testIdProvider } from "@tagikon/core/testing";
import { expect, suite, test } from "vitest";

import { MapStorageAdapter } from "./index.ts";

const createAdapter = async () =>
	new MapStorageAdapter<StorageAdapterTestTag>().initialize({ id: testIdProvider });

runStorageAdapterTests("MapStorageAdapter", createAdapter);

suite("MapStorageAdapter - custom ID provider", () => {
	test("uses the provided generator for new tag ids", async () => {
		let counter = 0;
		const numericPlugin: IdProvider<number> = {
			generate: () => ++counter,
			serialize: (id) => String(id),
			deserialize: (raw) => Number(raw),
		};
		const adapter = new MapStorageAdapter<Tag<number>>().initialize({ id: numericPlugin });
		const tag = await adapter.createTag({});
		expect(tag.id).toBe(1);
		expect(typeof tag.id).toBe("number");
	});

	test("serialize/deserialize roundtrip for listObjectTags with numeric id", async () => {
		let counter = 0;
		const numericPlugin: IdProvider<number> = {
			generate: () => ++counter,
			serialize: (id) => String(id),
			deserialize: (raw) => Number(raw),
		};
		const adapter = new MapStorageAdapter<Tag<number>>().initialize({ id: numericPlugin });
		const tag = await adapter.createTag({});
		await adapter.addRelations(tag.id, [objectKey("obj1")]);
		const tagIds = await adapter.listObjectTags(objectKey("obj1"));
		expect(tagIds).toEqual([tag.id]);
		expect(typeof tagIds[0]).toBe("number");
	});
});
