import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { corpusFiles, describeCorpus, describeErrors, parseWithSchemas } from "./corpus";

/**
 * The examples of the portal check themselves.
 *
 * Every page of `stxt-lang/{es,en}` is a `dev.stxt.website` document whose `Code` blocks
 * are, by contract, valid STXT (anything else goes to `Listing`). This suite enforces it:
 *
 * - Every `Code` block must parse with no errors.
 * - The schemas and templates a page shows must load (they validate against their
 *   meta-schema), and the examples of the page are validated against them. An example is
 *   checked when the page defines every namespace it uses (roots and descendants), each
 *   one taken from its *closest* definition in the page: the last one shown before the
 *   example or, when none precedes it, the first one shown after it. That is what the
 *   reader sees, and it lets a page show the same namespace with several shapes (the
 *   specifications do). Nothing from `.stxt/` is used: a page is self-contained.
 * - A `Code` block holding a comment line that starts with `# ERROR` is a deliberately
 *   invalid example (an "error the validator catches"): it must still parse, it must have
 *   a definition in the page to be checked against, and it must NOT validate.
 * - No page uses the `stxt.play.*` family, reserved to the seed of the playground.
 *
 * Born from a home page example that did not validate against the template shown right
 * below it, and nobody noticed for days.
 */

// Language folders of the portal.
const PAGE_DIRS = ["es", "en"];

// Namespace family reserved to the seed of the playground (`../stxt-play`).
const PLAYGROUND_FAMILY = /\bstxt\.play\b/i;

// A comment line marking a deliberately invalid example.
const ERROR_MARKER = /^\s*#\s*ERROR\b/;

// Reserved namespaces whose documents are definitions, not examples.
const DEFINITION_NAMESPACES = ["@stxt.schema", "@stxt.template"];

// A `Code` block of a page: its text and the page line it starts at, for the messages.
interface CodeBlock {
	line: number;
	text: string;
}

// A `Code` block that defines schemas/templates, with the namespaces it defines.
interface Definition {
	block: CodeBlock;
	position: number;
	namespaces: string[];
}

// The `Code` blocks of a parsed page, in reading order.
function codeBlocks(nodes: readonly Node[]): CodeBlock[] {
	const result: CodeBlock[] = [];

	const walk = (node: Node): void => {
		if (node.isTextNode()) {
			if (node.getCanonicalName() === "code") {
				result.push({ line: node.getLine(), text: node.getText() });
			}
			return;
		}
		for (const child of (node as InlineNode).getChildren()) {
			walk(child);
		}
	};

	nodes.forEach(walk);
	return result;
}

// Whether the block is marked as a deliberately invalid example.
function isMarkedInvalid(block: CodeBlock): boolean {
	return block.text.split("\n").some(line => ERROR_MARKER.test(line));
}

// Whether the block defines schemas or templates (rather than being an example).
function isDefinition(roots: readonly Node[]): boolean {
	return roots.some(node => DEFINITION_NAMESPACES.includes(node.getNamespace()));
}

// Effective namespaces of every node of an example (roots and descendants), without the
// empty one and without repeats: all of them need a definition for the example to be checked.
function namespacesOf(roots: readonly Node[]): string[] {
	const result = new Set<string>();

	const walk = (node: Node): void => {
		if (node.getNamespace() !== "") {
			result.add(node.getNamespace());
		}
		if (!node.isTextNode()) {
			(node as InlineNode).getChildren().forEach(walk);
		}
	};

	roots.forEach(walk);
	return [...result];
}

// Loads a definition block into a fresh provider (throws if it does not load).
function loadDefinition(text: string): UnifiedSchemaProvider {
	const provider = new UnifiedSchemaProvider();
	provider.addFile(text);
	return provider;
}

/**
 * The definition of a namespace that applies to the example at a position: the last one
 * shown before it or, failing that, the first one shown after it.
 */
function closestDefinition(definitions: readonly Definition[], namespace: string, position: number): Definition | undefined {
	const candidates = definitions.filter(definition => definition.namespaces.includes(namespace));
	const before = candidates.filter(definition => definition.position < position);

	return before.length > 0 ? before[before.length - 1] : candidates.find(definition => definition.position > position);
}

describeCorpus("Examples of the portal (stxt-lang/{es,en})", root => {
	const pages = corpusFiles(root, PAGE_DIRS);
	let validated = 0;

	it("the portal is not empty", () => {
		assert.ok(pages.length > 0, `no .stxt page found in ${PAGE_DIRS.join(", ")}`);
	});

	for (const page of pages) {
		const name = path.relative(root, page);
		const nodes = new Parser().parseResult(fs.readFileSync(page, "utf-8")).getNodes();
		const blocks = codeBlocks(nodes);

		describe(name, () => {
			it("every Code block parses", () => {
				const failures = blocks
					.map(block => ({ block, errors: new Parser().parseResult(block.text).getErrors() }))
					.filter(({ errors }) => errors.length > 0)
					.map(({ block, errors }) => `\n  Code block at line ${block.line}:${describeErrors(errors)}`);

				assert.strictEqual(failures.length, 0, `${name}: ${failures.length} Code block(s) do not parse:${failures.join("")}`);
			});

			it("no Code block uses the playground family stxt.play.*", () => {
				const offenders = blocks.filter(block => PLAYGROUND_FAMILY.test(block.text)).map(block => block.line);

				assert.strictEqual(offenders.length, 0, `${name}: stxt.play.* is reserved to the seed of the playground; found in the Code block(s) at line(s) ${offenders.join(", ")}`);
			});

			// Only the blocks that parse take part in the rest; the others are reported above.
			const parsed = blocks
				.map((block, position) => ({ block, position, roots: new Parser().parseResult(block.text) }))
				.filter(({ roots }) => roots.getErrors().length === 0)
				.map(({ block, position, roots }) => ({ block, position, roots: roots.getNodes() }));

			// First pass: the definitions of the page, checked to load, with their namespaces.
			const definitions: Definition[] = [];

			for (const { block, position, roots } of parsed.filter(entry => isDefinition(entry.roots))) {
				const where = `${name}, Code block at line ${block.line}`;

				if (isMarkedInvalid(block)) {
					it(`line ${block.line}: the definition is deliberately invalid`, () => {
						assert.throws(() => loadDefinition(block.text), `${where}: marked with "# ERROR" but the definition loads without errors`);
					});
					continue;
				}

				let namespaces: string[] = [];
				let failure: unknown = null;
				try {
					namespaces = loadDefinition(block.text).getAllSchemas().map(schema => schema.getNamespace());
				} catch (error) {
					failure = error;
				}

				it(`line ${block.line}: the definition of ${namespaces.join(", ") || "?"} loads`, () => {
					if (failure) {
						throw failure;
					}
				});

				if (!failure) {
					definitions.push({ block, position, namespaces });
				}
			}

			// Second pass: every example against the closest definitions of its namespaces.
			for (const { block, position, roots } of parsed.filter(entry => !isDefinition(entry.roots))) {
				const where = `${name}, Code block at line ${block.line}`;
				const marked = isMarkedInvalid(block);
				const namespaces = namespacesOf(roots);
				const applicable = namespaces.map(namespace => closestDefinition(definitions, namespace, position));

				if (namespaces.length === 0 || applicable.some(definition => !definition)) {
					// Not checkable: no namespace, or one the page does not define (an isolated
					// snippet). A marked example, though, has to be checkable.
					if (marked) {
						it(`line ${block.line}: is a deliberately invalid example`, () => {
							assert.fail(`${where}: marked with "# ERROR" but this page defines no schema/template for ${namespaces.join(", ") || "its (empty) namespace"}`);
						});
					}
					continue;
				}

				// The provider the reader has in mind: only the chosen definitions, in page order.
				const chosen = [...new Set(applicable as Definition[])].sort((a, b) => a.position - b.position);
				const provider = new UnifiedSchemaProvider();
				chosen.forEach(definition => provider.addFile(definition.block.text));

				const label = `${namespaces.join(", ")} (line${chosen.length > 1 ? "s" : ""} ${chosen.map(d => d.block.line).join(", ")})`;
				validated++;

				if (marked) {
					it(`line ${block.line}: is a deliberately invalid example of ${label}`, () => {
						const errors = parseWithSchemas(block.text, provider).getErrors();
						assert.ok(errors.length > 0, `${where}: marked with "# ERROR" but it validates against ${label}`);
					});
				} else {
					it(`line ${block.line}: validates against ${label}`, () => {
						const errors = parseWithSchemas(block.text, provider).getErrors();
						assert.strictEqual(errors.length, 0, `${where}: ${errors.length} error(s) against ${label}:${describeErrors(errors)}`);
					});
				}
			}
		});
	}

	it("at least one example is validated against a definition of its own page", () => {
		// If this fails, the suite above proves nothing about validation.
		assert.ok(validated > 0, "no page shows a definition together with an example of it");
	});
});
