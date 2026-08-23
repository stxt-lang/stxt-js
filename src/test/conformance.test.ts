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
import { DiscoveryResolver } from "../discovery/DiscoveryResolver";
import { IndentStyle, NodeWriter } from "../runtime/NodeWriter";
import { Formatter } from "../runtime/Formatter";
import { MemoryFileSystem, TestEnvironment } from "./discoveryMemory";
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
 * - `discovery`: a virtual file system and environment resolve to the expected chain, active
 *   definitions and resolution errors (STXT-DISCOVERY-SPEC).
 * - `writer`: the root nodes of the input, written in canonical text form, equal the expected
 *   text in both styles (STXT-TREE-SPEC 11).
 * - `format`: the input reformatted equals the expected text in both styles, with the expected
 *   syntax errors (STXT-TREE-SPEC 12).
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
	error?: { code: string; line: number };
	definitions?: string[][];
	kind?: string;
	files?: Record<string, string>;
	dirs?: string[];
	documentDir?: string | null;
	environment?: { stxtPath: string[] | null; userDir: string | null; systemDir: string | null };
	expected?: any;
	errors?: { code: string; line: number }[];
}

const STYLES: [string, IndentStyle][] = [["tabs", IndentStyle.TABS], ["spaces", IndentStyle.SPACES_4]];

interface ExpectedError { code: string; file?: string; namespace?: string }

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

	it("declares cumulative profiles that cover every category", () => {
		const profiles: Record<string, any> = (manifest as any).profiles;
		const covered = new Set<string>();
		for (const [name, p] of Object.entries(profiles)) {
			if (p.includes) assert.ok(profiles[p.includes], `profile ${name} includes unknown profile ${p.includes}`);
			for (const s of p.specifications) assert.ok(manifest.specifications[s], `profile ${name}: unknown specification ${s}`);
			p.categories.forEach((c: string) => covered.add(c));
		}
		for (const c of new Set(manifest.cases.map(c => c.category))) assert.ok(covered.has(c), `category ${c} belongs to no profile`);
	});

	it("lists every case file, and every case exactly once", () => {
		const ids = manifest.cases.map(c => c.id);
		assert.deepStrictEqual(ids, [...new Set(ids)], "duplicate case ids");
		const listed = new Set(manifest.cases.map(c => c.input));
		for (const sub of ["tree", "parse", "validate", "definition-errors", "format"]) {
			for (const file of fs.readdirSync(path.join(directory, sub)).filter(f => f.endsWith(".stxt") && !/\.(tabs|spaces)\.stxt$/.test(f))) {
				assert.ok(listed.has(`${sub}/${file}`), `${sub}/${file} is not in the manifest`);
			}
		}
	});

	for (const c of manifest.cases) {
		it(`${c.id}: ${c.description}`, async () => {
			if (c.category === "discovery") {
				const mounted: Record<string, string> = {};
				for (const [virtual, real] of Object.entries(c.files!)) mounted[virtual] = read(real);
				const fs = new MemoryFileSystem(mounted);
				for (const dir of c.dirs ?? []) fs.addEmptyDir(dir);
				const env = new TestEnvironment(c.environment!.stxtPath, c.environment!.userDir, c.environment!.systemDir);
				const result = await new DiscoveryResolver(fs, env).resolve(c.documentDir ?? null);

				assert.deepStrictEqual([...result.getChain()], c.expected.chain, `${c.id}: chain`);
				for (const [namespace, file] of Object.entries<string | null>(c.expected.active)) {
					assert.strictEqual(result.getDefinition(namespace)?.file ?? null, file, `${c.id}: active definition of ${namespace}`);
					assert.strictEqual(result.getSchema(namespace) ? true : false, file !== null, `${c.id}: getSchema(${namespace})`);
				}
				const actual = result.getErrors().map(e => ({ code: e.code, file: e.file, namespace: e.namespace }));
				const expected: ExpectedError[] = c.expected.errors;
				assert.strictEqual(actual.length, expected.length, `${c.id}: errors ${JSON.stringify(actual)}`);
				for (const e of expected) {
					const i = actual.findIndex(a => a.code === e.code && (e.file === undefined || a.file === e.file) && (e.namespace === undefined || a.namespace === e.namespace));
					assert.ok(i >= 0, `${c.id}: missing error ${JSON.stringify(e)} in ${JSON.stringify(actual)}`);
					actual.splice(i, 1);
				}
				return;
			}
			const input = read(c.input);
			switch (c.category) {
				case "tree": {
					const nodes = new Parser().parse(input);
					const actual = JSON.parse(toCanonicalJson(nodes));
					assert.deepStrictEqual(actual, JSON.parse(read(c.expected)));
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
				case "writer": {
					const nodes = new Parser().parse(input);
					for (const [key, style] of STYLES) {
						assert.strictEqual(NodeWriter.toSTXTDocs(nodes, style), read(c.expected[key]), `${c.id}: ${key}`);
					}
					break;
				}
				case "format": {
					for (const [key, style] of STYLES) {
						const result = Formatter.format(input, style);
						assert.strictEqual(result.text, read(c.expected[key]), `${c.id}: ${key}`);
						assert.deepStrictEqual(result.errors.map(e => ({ code: e.code, line: e.line })), c.errors, `${c.id}: errors with ${key}`);
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
