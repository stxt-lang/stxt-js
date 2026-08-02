import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { ParseResult } from "../core/ParseResult";
import { ConditionalValidator } from "../runtime/ConditionalValidator";
import { SchemaValidator } from "../schema/SchemaValidator";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { ParseException } from "../exceptions/ParseException";

/**
 * Helpers for the regression tests against the real corpus in `../../stxt-web`.
 *
 * The corpus is deliberately not copied into this repository: stxt-web is the
 * normative source of the language and the tests must fail when the implementation
 * drifts away from the real documents, not from a frozen copy.
 */

// Folders of stxt-web holding schemas and templates (they are loaded into the provider).
export const SCHEMA_DIRS = [".stxt", "examples/definitions"];

// Folders of stxt-web holding documents that must validate against those schemas.
export const DOC_DIRS = ["docs", "es", "en"];

/**
 * Locates `stxt-web`. It can be forced with the STXT_WEB environment variable;
 * by default it is looked up as a sibling project (../../stxt-web from this repo).
 *
 * @returns the root of stxt-web, or undefined if it is not available.
 */
export function findStxtWeb(): string | undefined {
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

	return undefined;
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
 * `describe` that skips the whole block (marking it as pending) when stxt-web is
 * not available, so that the test does not fail in an isolated clone.
 *
 * @param title title of the block.
 * @param body body of the block, which gets the root of stxt-web.
 */
export function describeCorpus(title: string, body: (root: string) => void): void {
	const root = findStxtWeb();

	if (root === undefined) {
		describe(title, () => {
			it("requires the sibling project stxt-web (use STXT_WEB=/path to point at it)");
		});
		return;
	}

	describe(title, () => body(root));
}
