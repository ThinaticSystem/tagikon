import { expect, suite, test } from "vitest";

import { stringIdProvider } from "./index.ts";

suite("stringIdProvider", () => {
	test("generate calls the provided factory", () => {
		let serial = 0;
		const idProvider = stringIdProvider(() => `id-${++serial}` as `id-${number}`);
		expect(idProvider.generate()).toBe("id-1");
		expect(idProvider.generate()).toBe("id-2");
	});

	test("serialize is identity", () => {
		const idProvider = stringIdProvider(() => "x");
		expect(idProvider.serialize("x")).toBe("x");
	});

	test("deserialize is identity", () => {
		const idProvider = stringIdProvider(() => "x");
		expect(idProvider.deserialize("hello")).toBe("hello");
	});

	test("empty string", () => {
		const idProvider = stringIdProvider(() => "");
		expect(idProvider.generate()).toBe("");
		expect(idProvider.serialize("")).toBe("");
		expect(idProvider.deserialize("")).toBe("");
	});
});
