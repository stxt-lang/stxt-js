import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { toCanonicalJson } from "../runtime/TreeJson";
import { corpusFiles, describeCorpus } from "./corpus";

/**
 * STXT-TREE-SPEC conformance: every source fixture is parsed to the shared
 * canonical JSON tree. The comparison is semantic JSON, never whitespace.
 */
describeCorpus("Canonical document tree", root => {
	const directory = "conformance/tree";
	const files = corpusFiles(root, [directory]);

	it("the tree corpus is not empty", () => {
		assert.ok(files.length > 0, `no .stxt file found in ${directory}`);
	});

	for (const file of files) {
		const relative = path.relative(root, file);
		const expectedFile = file.substring(0, file.length - ".stxt".length) + ".json";

		it(`matches ${relative}`, () => {
			assert.ok(fs.existsSync(expectedFile), `${relative}: missing ${path.basename(expectedFile)}`);

			const nodes = new Parser().parse(fs.readFileSync(file, "utf-8"));
			const actual = JSON.parse(toCanonicalJson(nodes));
			const expected = JSON.parse(fs.readFileSync(expectedFile, "utf-8"));

			assert.deepStrictEqual(actual, expected);
		});
	}
});
