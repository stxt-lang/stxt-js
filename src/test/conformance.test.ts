import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { SchemaProvider } from "../schema/SchemaProvider";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaValidator } from "../schema/SchemaValidator";
import { TemplateSchemaProviderMemory } from "../template/TemplateSchemaProviderMemory";
import { toCanonicalJson } from "../runtime/TreeJson";
import { describeCorpus } from "./corpus";

/**
 * The STXT conformance kit: `conformance/manifest.json` of stxt-lang lists every case with
 * its category and expected result, so that any implementation can run the same cases with
 * a small runner like this one and no knowledge of the other ports' test suites.
 *
 * - `tree`: the input parses and its canonical tree (STXT-TREE-SPEC) equals the expected
 *   JSON file, compared as a JSON value.
 * - `parse-error`: the input is rejected, and the first error carries the expected code and
 *   line (STXT-SPEC 11.1).
 * - `validate`: with every set of definitions, the input validates with no error.
 * - `validate-error`: with every set of definitions, the first validation error carries the
 *   expected code and line (STXT-SCHEMA-SPEC 13.1).
 * - `definition-error`: loading the input as a schema or a template fails with the expected
 *   code and line (STXT-SCHEMA-SPEC 13.1, STXT-TEMPLATE-SPEC 14.1).
 */
interface Manifest {
	kit: string;
	specifications: Record<string, string>;
	cases: Case[];
}

interface Case {
	id: string;
	category: string;
	spec: string;
	description: string;
	input: string;
	expected?: string;
	error?: { code: string; line: number };
	definitions?: string[][];
	kind?: string;
}

type Failure = { code: string; line: number };

/** A provider holding the given definition files: schemas first, templates on top of them. */
function loadDefinitions(read: (file: string) => string, files: string[]): SchemaProvider {
	const schemas = new SchemaProviderMemory();
	const templates = new TemplateSchemaProviderMemory(schemas);
	for (const file of files) {
		if (file.endsWith(".schema.stxt")) schemas.addSchema(read(file));
		else if (file.endsWith(".template.stxt")) templates.addTemplate(read(file));
		else assert.fail(`${file}: a definition file must end in .schema.stxt or .template.stxt`);
	}
	return templates;
}

/** The first validation error of the document against the provider, or undefined. */
function firstValidationError(text: string, provider: SchemaProvider): Failure | undefined {
	const validator = new SchemaValidator(provider, true);
	for (const node of new Parser().parse(text)) {
		const errors = validator.validate(node);
		if (errors.length > 0) return { code: errors[0].code, line: errors[0].line };
	}
	return undefined;
}

/** The error thrown by the function, which must be a ValidationException or ParseException. */
function failure(fn: () => unknown): Failure | undefined {
	try {
		fn();
	} catch (e) {
		if (e instanceof ValidationException || e instanceof ParseException) return { code: e.code, line: e.line };
		throw e;
	}
	return undefined;
}

describeCorpus("Conformance kit", root => {
	const directory = path.join(root, "conformance");
	const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf-8"));
	// Definition files are told apart by suffix; the inputs of definition-error cases carry the
	// kind in the manifest instead, so their virtual name `<input>.<kind>.stxt` maps back here.
	const read = (file: string) => fs.readFileSync(path.join(directory, file.replace(/\.(schema|template)\.stxt$/, (m, k) => fs.existsSync(path.join(directory, file)) ? m : ".stxt")), "utf-8");

	it("declares a kit version and the specifications it covers", () => {
		assert.match(manifest.kit, /^\d+\.\d+$/);
		assert.strictEqual(manifest.specifications["STXT-SPEC"], "1.0");
		assert.strictEqual(manifest.specifications["STXT-TREE-SPEC"], "1.0");
		assert.ok(manifest.cases.length > 0);
	});

	it("lists every case file, and every case exactly once", () => {
		const ids = manifest.cases.map(c => c.id);
		assert.deepStrictEqual(ids, [...new Set(ids)], "duplicate case ids");
		const listed = new Set(manifest.cases.map(c => c.input));
		for (const sub of ["tree", "parse", "validate", "definition-errors"]) {
			for (const file of fs.readdirSync(path.join(directory, sub)).filter(f => f.endsWith(".stxt"))) {
				assert.ok(listed.has(`${sub}/${file}`), `${sub}/${file} is not in the manifest`);
			}
		}
	});

	for (const c of manifest.cases) {
		it(`${c.id}: ${c.description}`, () => {
			const input = read(c.input);
			switch (c.category) {
				case "tree": {
					const nodes = new Parser().parse(input);
					const actual = JSON.parse(toCanonicalJson(nodes));
					assert.deepStrictEqual(actual, JSON.parse(read(c.expected!)));
					break;
				}
				case "parse-error": {
					let error: ParseException | undefined;
					try {
						new Parser().parse(input);
					} catch (e) {
						if (!(e instanceof ParseException)) throw e;
						error = e;
					}
					assert.ok(error, `${c.id}: parsed without errors, expected ${c.error!.code}`);
					assert.deepStrictEqual({ code: error.code, line: error.line }, c.error);
					break;
				}
				case "validate":
				case "validate-error": {
					for (const set of c.definitions!) {
						const provider = loadDefinitions(read, set);
						const actual = firstValidationError(input, provider);
						const where = `${c.id} with [${set.join(", ")}]`;
						if (c.category === "validate") assert.strictEqual(actual, undefined, `${where}: ${JSON.stringify(actual)}`);
						else assert.deepStrictEqual(actual, c.error, where);
					}
					break;
				}
				case "definition-error": {
					const actual = failure(() => loadDefinitions(read, [c.input.replace(/\.stxt$/, `.${c.kind}.stxt`)]));
					assert.deepStrictEqual(actual, c.error, `${c.id}: loaded without errors or with another error`);
					break;
				}
				default:
					assert.fail(`${c.id}: unknown category ${c.category}`);
			}
		});
	}
});
