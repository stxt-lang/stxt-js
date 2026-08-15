import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { ParseResult } from "../core/ParseResult";
import { ConditionalValidator } from "../runtime/ConditionalValidator";
import { SchemaValidator } from "../schema/SchemaValidator";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { ParseException } from "../exceptions/ParseException";

/**
 * Helpers for the regression tests against the real corpus in `../stxt-web`.
 *
 * The corpus is deliberately not copied into this repository: stxt-web is the
 * normative source of the language and the tests must fail when the implementation
 * drifts away from the real documents, not from a frozen copy.
 *
 * The corpus is mandatory: if `stxt-web` cannot be located, the corpus suites fail
 * (they are never skipped). A silently skipped corpus once hid a broken locator for
 * days, so "no corpus" is treated as an error, not as a pending run.
 */

// Folders of stxt-web holding schemas and templates (they are loaded into the provider).
export const SCHEMA_DIRS = [".stxt", "examples/definitions"];

// Folders of stxt-web holding documents that must validate against those schemas.
export const DOC_DIRS = ["docs", "es", "en"];

/**
 * Locates `stxt-web`. It can be forced with the STXT_WEB environment variable;
 * by default it is looked up as a sibling project (`../stxt-web` from this repo).
 *
 * @returns the root of stxt-web.
 * @throws Error if it cannot be found: the corpus is mandatory, never optional.
 */
export function findStxtWeb(): string {
	const candidates = [
		process.env.STXT_WEB,
		// __dirname is <repo>/out/test
		path.resolve(__dirname, "..", "..", "..", "stxt-web"),
	];

	for (const candidate of candidates) {
		if (candidate && fs.existsSync(path.join(candidate, ".stxt"))) {
			return candidate;
		}
	}

	throw new Error(
		"The corpus of the sibling project stxt-web is required and was not found. Tried: "
		+ candidates.filter(c => c).map(c => `"${c}"`).join(", ")
		+ ". Clone stxt-lang/stxt-web next to this repository or set STXT_WEB=/path/to/stxt-web.");
}

// Every .stxt file under a directory, recursively and in a stable order.
export function findStxtFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}

	const result: string[] = [];

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			result.push(...findStxtFiles(full));
		} else if (entry.name.endsWith(".stxt")) {
			result.push(full);
		}
	}

	return result.sort();
}

// The .stxt files of the given folders, relative to the root of stxt-web.
export function corpusFiles(root: string, dirs: readonly string[]): string[] {
	return dirs.flatMap(dir => findStxtFiles(path.join(root, dir)));
}

/**
 * Loads into a provider every schema/template of the given folders, just like
 * `SchemaLoader` does with `<workspace>/.stxt/**`.
 *
 * @param root root of stxt-web.
 * @param dirs folders to load the schemas and templates from.
 * @returns the provider with everything already registered.
 */
export function loadProvider(root: string, dirs: readonly string[] = SCHEMA_DIRS): UnifiedSchemaProvider {
	const provider = new UnifiedSchemaProvider();

	for (const file of corpusFiles(root, dirs)) {
		provider.addFile(fs.readFileSync(file, "utf-8"));
	}

	return provider;
}

/**
 * Parses a document validating it against the provider, just like `analysisDoc`.
 *
 * @param text document to parse.
 * @param provider provider the schema of each namespace is resolved from.
 * @returns the result of parsing, with every error found.
 */
export function parseWithSchemas(text: string, provider: UnifiedSchemaProvider): ParseResult {
	const parser = new Parser();
	parser.registerValidator(new ConditionalValidator(new SchemaValidator(provider)));

	return parser.parseResult(text);
}

// Readable message for the assert: `[CODE] line 12: message`.
export function describeErrors(errors: readonly ParseException[]): string {
	return errors.map(e => `\n\t[${e.code}] line ${e.line}: ${e.message}`).join("");
}

/**
 * `describe` over the corpus. When stxt-web cannot be located the block is NOT
 * skipped: it turns into a single failing test that explains what is missing, so
 * that a broken locator or an isolated clone can never pass unnoticed.
 *
 * @param title title of the block.
 * @param body body of the block, which gets the root of stxt-web.
 */
export function describeCorpus(title: string, body: (root: string) => void): void {
	let root: string;
	try {
		root = findStxtWeb();
	}
	catch (error) {
		describe(title, () => {
			it("finds the mandatory corpus of the sibling project stxt-web", () => {
				throw error;
			});
		});
		return;
	}

	describe(title, () => body(root));
}
