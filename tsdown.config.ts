import { defineConfig } from "tsdown";

export default defineConfig({
	// TODO: The plugin entry point should be separate
	entry: ["src/index.ts"],
	outDir: "built",
	dts: { build: true },
	attw: {
		level: "error",
		profile: "esm-only",
	},
});
