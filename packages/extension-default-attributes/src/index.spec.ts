import type { Tag } from "@tagikon/core";
import type { Uuid } from "@tagikon/id-provider-uuid";

import { setupTagikon, tpc, use } from "@tagikon/core";
import { UUID_ID_PROVIDER } from "@tagikon/id-provider-uuid";
import { MapStorageAdapter } from "@tagikon/storage-adapter-in-memory-map";
import { expect, suite, test } from "vitest";

import { createDefaultAttributes } from "./index.ts";

interface TagWithMeta extends Tag<Uuid> {
	readonly label: string;
	readonly priority: number;
}

suite("createDefaultAttributes", () => {
	const makeTagikonWithDefaults = () => {
		const storage = new MapStorageAdapter<TagWithMeta>();
		const extension = createDefaultAttributes<TagWithMeta>({
			label: () => "default-label",
			priority: () => 0,
		});
		return setupTagikon({
			tagShape: {
				id: UUID_ID_PROVIDER,
				label: tpc.string(),
				priority: tpc.number(),
			},
			storageAdapter: storage,
			extensions: [use(extension)],
		});
	};

	suite("addTag", () => {
		test("fills in attributes absent from input", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>();
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default-label",
				priority: () => 0,
			});
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					priority: tpc.number(),
				},
				storageAdapter: storage,
				extensions: [use(extension)],
			});

			const tag = await tagikon.addTag({} as Omit<TagWithMeta, "id">);
			expect(tag.label).toBe("default-label");
			expect(tag.priority).toBe(0);
		});

		test("explicit input takes precedence over defaults", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>();
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default-label",
				priority: () => 0,
			});
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					priority: tpc.number(),
				},
				storageAdapter: storage,
				extensions: [use(extension)],
			});

			const tag = await tagikon.addTag({ label: "custom", priority: 99 });
			expect(tag.label).toBe("custom");
			expect(tag.priority).toBe(99);
		});

		test("provider function is called freshly on each addTag", async () => {
			let count = 0;
			const storage = new MapStorageAdapter<TagWithMeta>();
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default-label",
				priority: () => ++count,
			});
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					priority: tpc.number(),
				},
				storageAdapter: storage,
				extensions: [use(extension)],
			});

			const first = await tagikon.addTag({} as Omit<TagWithMeta, "id">);
			const second = await tagikon.addTag({} as Omit<TagWithMeta, "id">);
			expect(first.priority).toBe(1);
			expect(second.priority).toBe(2);
		});

		test("partial input: absent attributes receive defaults, present ones are preserved", async () => {
			const storage = new MapStorageAdapter<TagWithMeta>();
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "fallback",
				priority: () => 5,
			});
			const tagikon = setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					priority: tpc.number(),
				},
				storageAdapter: storage,
				extensions: [use(extension)],
			});

			const tag = await tagikon.addTag({ label: "provided" } as Omit<TagWithMeta, "id">);
			expect(tag.label).toBe("provided");
			expect(tag.priority).toBe(5);
		});
	});

	suite("editTag", () => {
		test("does not apply defaults — only the patched fields change", async () => {
			const tagikon = makeTagikonWithDefaults();

			const tag = await tagikon.addTag({ label: "original", priority: 42 });
			const updated = await tagikon.editTag(tag.id, { label: "updated" });

			expect(updated.label).toBe("updated");
			expect(updated.priority).toBe(42);
		});
	});

	suite("addTag with falsy explicit values", () => {
		const makeTagikonWithNonZeroDefault = () => {
			const storage = new MapStorageAdapter<TagWithMeta>();
			const extension = createDefaultAttributes<TagWithMeta>({
				label: () => "default",
				priority: () => 99,
			});
			return setupTagikon({
				tagShape: {
					id: UUID_ID_PROVIDER,
					label: tpc.string(),
					priority: tpc.number(),
				},
				storageAdapter: storage,
				extensions: [use(extension)],
			});
		};

		test.each([
			{ label: "test", priority: 0 },
			{ label: "test", priority: -1 },
		])(
			"numeric value $priority is not replaced by the default (99)",
			async ({ label, priority }) => {
				const tagikon = makeTagikonWithNonZeroDefault();
				const tag = await tagikon.addTag({ label, priority });
				expect(tag.priority).toBe(priority);
			},
		);

		test("empty string is not replaced by the default", async () => {
			const tagikon = makeTagikonWithNonZeroDefault();
			const tag = await tagikon.addTag({ label: "", priority: 1 });
			expect(tag.label).toBe("");
		});
	});
});
