import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "built",
	dts: { build: true },
	attw: {
		level: "error",
		profile: "esm-only",
	},
	deps: {
		neverBundle: ["@tagikon/core"],
	},
});
