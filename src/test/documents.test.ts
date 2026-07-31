import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, loadProvider, parseWithSchemas } from "./corpus";

/**
 * Validation regression: the real documents of stxt-web must parse with no errors
 * and validate with no warnings against the schemas/templates of stxt-web itself.
 *
 * This is the check that used to be done by hand after every conformance change.
 */
describeCorpus("Documents of stxt-web", root => {
	const provider = loadProvider(root);
	const files = corpusFiles(root, DOC_DIRS);

	it("the corpus is not empty", () => {
		assert.ok(files.length > 0, `no .stxt file found in ${DOC_DIRS.join(", ")}`);
	});

	for (const file of files) {
		const name = path.relative(root, file);

		it(`validates ${name}`, () => {
			const result = parseWithSchemas(fs.readFileSync(file, "utf-8"), provider);
			const errors = result.getErrors();

			assert.strictEqual(errors.length, 0, `${name} has ${errors.length} error(s):${describeErrors(errors)}`);
			assert.ok(result.getNodes().length > 0, `${name} produced no node at all`);
		});
	}

	it("every document declares a namespace with a known schema", () => {
		// If this fails, the tests above would pass trivially: with no namespace
		// the ConditionalValidator validates nothing.
		for (const file of files) {
			const nodes = new Parser().parseResult(fs.readFileSync(file, "utf-8")).getNodes();

			for (const node of nodes) {
				const namespace = node.getNamespace();
				const name = `${path.relative(root, file)} → ${node.getName()}`;

				assert.notStrictEqual(namespace, "", `${name}: document with no namespace`);
				assert.ok(provider.getSchema(namespace), `${name}: there is no schema for ${namespace}`);
			}
		}
	});
});

/**
 * One same namespace is described twice in stxt-web: as a schema (`.stxt/schemas/`)
 * and as a template (`.stxt/templates/`). Since the template is compiled into a
 * Schema, both must validate the documents exactly the same way.
 */
describeCorpus("Schema ↔ template equivalence", root => {
	const fromSchemas = loadProvider(root, [path.join(".stxt", "schemas")]);
	const fromTemplates = loadProvider(root, [path.join(".stxt", "templates")]);
	const files = corpusFiles(root, DOC_DIRS);

	for (const file of files) {
		const name = path.relative(root, file);
		const text = fs.readFileSync(file, "utf-8");
		const namespaces = new Parser().parseResult(text).getNodes().map(node => node.getNamespace());

		// Only the documents whose namespace is described both ways are comparable.
		if (!namespaces.every(ns => fromSchemas.getSchema(ns) && fromTemplates.getSchema(ns))) {
			continue;
		}

		it(`same result in ${name}`, () => {
			const codes = (provider: typeof fromSchemas) =>
				parseWithSchemas(text, provider).getErrors().map(e => `[${e.code}] line ${e.line}`);

			assert.deepStrictEqual(codes(fromTemplates), codes(fromSchemas), `${name}: the template and the schema do not validate the same`);
		});
	}
});
