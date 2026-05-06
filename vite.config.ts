import { resolve } from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@tagikon/core": resolve(rootDir, "packages/core/src/index.ts"),
			"@tagikon/id-provider-string": resolve(rootDir, "packages/id-provider-string/src/index.ts"),
			"@tagikon/id-provider-uuid": resolve(rootDir, "packages/id-provider-uuid/src/index.ts"),
			"@tagikon/storage-adapter-in-memory-map": resolve(
				rootDir,
				"packages/storage-adapter-in-memory-map/src/index.ts",
			),
			"@tagikon/storage-adapter-drizzle": resolve(
				rootDir,
				"packages/storage-adapter-drizzle/src/index.ts",
			),
			"@tagikon/extension-default-attributes": resolve(
				rootDir,
				"packages/extension-default-attributes/src/index.ts",
			),
			"@tagikon/extension-soft-delete": resolve(
				rootDir,
				"packages/extension-soft-delete/src/index.ts",
			),
			"@tagikon/extension-hierarchy": resolve(rootDir, "packages/extension-hierarchy/src/index.ts"),
			"@tagikon/codec-effect-schema": resolve(rootDir, "packages/codec-effect-schema/src/index.ts"),
		},
	},
	test: {
		include: ["packages/**/*.spec.ts"],
	},
});
