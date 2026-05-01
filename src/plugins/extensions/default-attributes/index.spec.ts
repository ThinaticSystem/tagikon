import type { Tag } from "../../../core/tag.ts";

import { expect, suite, test } from "vitest";

import { setupTagikon } from "../../../api/server.ts";
import { use } from "../../../plugin/extension/use.ts";
import { MapStorageAdapter } from "../../storage-adapters/map-storage-adapter/index.ts";
import { createDefaultAttributes } from "./index.ts";

interface TagWithMeta extends Tag {
	readonly label?: string;
	readonly priority?: number;
}

suite("createDefaultAttributes", () => {
	suite("addTag", () => {
		test("fills in attributes absent from input", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>();
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
			const storage = new MapStorageAdapter<TagWithMeta>();
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
			const storage = new MapStorageAdapter<TagWithMeta>();
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
			const storage = new MapStorageAdapter<TagWithMeta>();
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
