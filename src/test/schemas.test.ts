import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { corpusFiles, describeCorpus, SCHEMA_DIRS } from "./corpus";

/**
 * Loading regression: every real schema and template of stxt-lang must parse,
 * validate against its meta-schema and be transformed into a Schema without exception.
 *
 * Each file is loaded into a provider of its own so that a failure points at the
 * guilty file instead of being masked by the others.
 */
describeCorpus("Schemas and templates of stxt-lang", root => {
	const files = corpusFiles(root, SCHEMA_DIRS);

	it("the corpus is not empty", () => {
		assert.ok(files.length > 0, `no .stxt file found in ${path.join(root, SCHEMA_DIRS[0])}`);
	});

	for (const file of files) {
		it(`loads ${path.relative(root, file)}`, () => {
			const provider = new UnifiedSchemaProvider();
			provider.addFile(fs.readFileSync(file, "utf-8"));

			assert.ok(
				provider.getAllSchemas().length > 0,
				"the file produced no schema at all (root namespace other than @stxt.schema/@stxt.template?)"
			);
		});
	}

	it("all of them load together into a single provider", () => {
		const provider = new UnifiedSchemaProvider();

		for (const file of files) {
			provider.addFile(fs.readFileSync(file, "utf-8"));
		}

		// Schemas and templates share a namespace on purpose (the same model
		// described in two ways), so there are fewer schemas than files.
		assert.ok(provider.getAllSchemas().length > 0);
	});
});
