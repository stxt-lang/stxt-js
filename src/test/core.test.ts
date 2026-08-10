import * as assert from "assert";
import { Parser } from "../core/Parser";

describe("Core conformance regressions", () => {
	it("accepts a decomposed Unicode name and gives it the NFC canonical name", () => {
		const node = new Parser().parse("Cafe\u0301: value\n")[0];

		assert.strictEqual(node.getName(), "Cafe\u0301");
		assert.strictEqual(node.getNormalizedName(), "café");
		assert.strictEqual(node.getNormalizedName(), new Parser().parse("Café: value\n")[0].getNormalizedName());
	});
});
