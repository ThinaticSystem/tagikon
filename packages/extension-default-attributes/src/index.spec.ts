import type { Tag } from "@tagikon/core";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { setupTagikon, use } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import { createDefaultAttributes } from "./index.ts";

interface TagWithMeta extends Tag<Uuid> {
	readonly label?: string;
	readonly priority?: number;
}

suite("createDefaultAttributes", () => {
	suite("addTag", () => {
		test("fills in attributes absent from input", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>(UUID_ID_PROVIDER);
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default-label",
				priority: () => 0,
			});
			const tagikon = setupTagikon({ storageAdapter: storage, extensions: [use(extension)] });

			const tag = await tagikon.addTag({});
			expect(tag.label).toBe("default-label");
			expect(tag.priority).toBe(0);
		});

		test("explicit input takes precedence over defaults", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>(UUID_ID_PROVIDER);
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default-label",
				priority: () => 0,
			});
			const tagikon = setupTagikon({ storageAdapter: storage, extensions: [use(extension)] });

			const tag = await tagikon.addTag({ label: "custom", priority: 99 });
			expect(tag.label).toBe("custom");
			expect(tag.priority).toBe(99);
		});

		test("provider function is called freshly on each addTag", async () => {
			let count = 0;
			const storage = new MapStorageAdapter<TagWithMeta>(UUID_ID_PROVIDER);
			const extension = createDefaultAttributes<TagWithMeta>({
				priority: () => ++count,
			});
			const tagikon = setupTagikon({ storageAdapter: storage, extensions: [use(extension)] });

			const first = await tagikon.addTag({});
			const second = await tagikon.addTag({});
			expect(first.priority).toBe(1);
			expect(second.priority).toBe(2);
		});

		test("partial input: absent attributes receive defaults, present ones are preserved", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>(UUID_ID_PROVIDER);
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "fallback",
				priority: () => 5,
			});
			const tagikon = setupTagikon({ storageAdapter: storage, extensions: [use(extension)] });

			const tag = await tagikon.addTag({ label: "provided" });
			expect(tag.label).toBe("provided");
			expect(tag.priority).toBe(5);
		});
	});
});
