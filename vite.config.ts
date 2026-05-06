import { resolve } from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			// NOTE: @tagikon/core/testing must come before @tagikon/core — Vite uses first-match prefix semantics.
			{
				find: "@tagikon/core/testing",
				replacement: resolve(rootDir, "packages/core/src/plugin/storage-adapter/testing.ts"),
			},
			{
				find: "@tagikon/core",
				replacement: resolve(rootDir, "packages/core/src/index.ts"),
			},
			{
				find: "@tagikon/id-provider-string",
				replacement: resolve(rootDir, "packages/id-provider-string/src/index.ts"),
			},
			{
				find: "@tagikon/id-provider-uuid",
				replacement: resolve(rootDir, "packages/id-provider-uuid/src/index.ts"),
			},
			{
				find: "@tagikon/codec-effect-schema",
				replacement: resolve(rootDir, "packages/codec-effect-schema/src/index.ts"),
			},
			{
				find: "@tagikon/storage-adapter-in-memory-map",
				replacement: resolve(rootDir, "packages/storage-adapter-in-memory-map/src/index.ts"),
			},
			{
				find: "@tagikon/storage-adapter-drizzle",
				replacement: resolve(rootDir, "packages/storage-adapter-drizzle/src/index.ts"),
			},
			{
				find: "@tagikon/extension-default-attributes",
				replacement: resolve(rootDir, "packages/extension-default-attributes/src/index.ts"),
			},
			{
				find: "@tagikon/extension-soft-delete",
				replacement: resolve(rootDir, "packages/extension-soft-delete/src/index.ts"),
			},
			{
				find: "@tagikon/extension-hierarchy",
				replacement: resolve(rootDir, "packages/extension-hierarchy/src/index.ts"),
			},
		],
	},
	test: {
		include: ["packages/**/*.spec.ts"],
	},
});
