import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { Formatter } from "../runtime/Formatter";
import { IndentStyle } from "../runtime/NodeWriter";
import { toCanonicalJson } from "../runtime/TreeJson";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, SCHEMA_DIRS } from "./corpus";

const { TABS, SPACES_4 } = IndentStyle;

function format(text: string, style: IndentStyle = TABS): string {
	return Formatter.format(text, style).text;
}

function canonical(text: string): string {
	return toCanonicalJson(new Parser().parse(text));
}

/**
 * Everything formatting must not lose, around node lines that do need rewriting: comments (at
 * the margin and indented, with spaces so that formatting to tabs has to convert them), blank
 * lines outside and inside a block (the latter written empty, so that formatting has to indent
 * it), and the content of a text block with indentation of its own.
 */
const MESSY = [
	"# top comment",
	"Documento (test.fmt):   ",
	"    # indented comment",
	"    Titulo:Hello   ",
	"",
	"\tCuerpo >>",
	"\t\tfirst line",
	"",
	"\t\t    indented content",
	"\t\t\t\t",
	"\tAfter (test.fmt): block",
	"",
].join("\n");

const MESSY_TABS = [
	"# top comment",
	"Documento (test.fmt):",
	"\t# indented comment",
	"\tTitulo: Hello",
	"",
	"\tCuerpo >>",
	"\t\tfirst line",
	"\t\t",
	"\t\t    indented content",
	"\t\t",
	"\tAfter (test.fmt): block",
	"",
].join("\n");

const MESSY_SPACES = [
	"# top comment",
	"Documento (test.fmt):",
	"    # indented comment",
	"    Titulo: Hello",
	"",
	"    Cuerpo >>",
	"        first line",
	"        ",
	"            indented content",
	"        ",
	"    After (test.fmt): block",
	"",
].join("\n");

describe("Formatter", () => {

	describe("node lines", () => {

		it("rewrites the indentation according to the level of the node", () => {
			assert.strictEqual(format("Padre: p\n    Hijo: v"), "Padre: p\n\tHijo: v");
			assert.strictEqual(format("Padre: p\n\tHijo: v", SPACES_4), "Padre: p\n    Hijo: v");
		});

		it("writes exactly one space after the colon, and none without a value", () => {
			assert.strictEqual(format("Doc:    hola   "), "Doc: hola");
			assert.strictEqual(format("Doc:hola"), "Doc: hola");
			assert.strictEqual(format("Contenedor:"), "Contenedor:");
			assert.strictEqual(format("Contenedor:   "), "Contenedor:");
			assert.strictEqual(format("Contenedor (ns.uno):"), "Contenedor (ns.uno):");
		});

		it("writes the namespace only where the source wrote it", () => {
			const text = "Doc (a.b): x\n\tHijo (a.b): y\n\tOtro: z\n\tBloque (c.d) >>\n\t\ttexto";
			assert.strictEqual(format(text), text);
			assert.strictEqual(format("Doc (A.B):x\n\tHijo   (a.b):y"), "Doc (a.b): x\n\tHijo (a.b): y");
		});

		it("renders a block line as name, one space and >>", () => {
			assert.strictEqual(format("Doc  >>\n\tuna"), "Doc >>\n\tuna");
			assert.strictEqual(format("Doc>>   \n\tuna"), "Doc >>\n\tuna");
		});

		it("keeps the name as parsed, blanks collapsed", () => {
			assert.strictEqual(format("Mi   Nodo  : v"), "Mi Nodo: v");
		});
	});

	describe("text blocks", () => {

		it("re-indents the lines to the level of the block, keeping their own extra indentation", () => {
			assert.strictEqual(format("Doc >>\n    una línea\n        sangrada"), "Doc >>\n\tuna línea\n\t    sangrada");
			assert.strictEqual(format("Doc >>\n\tuna línea\n\t\tsangrada", SPACES_4), "Doc >>\n    una línea\n    \tsangrada");
		});

		it("indents the blank lines of a block to the level of the block, trailing ones included", () => {
			// STXT-SPEC 10.3: a blank line of a block is "" whatever its indentation; blank lines
			// outside a block have no level and stay empty.
			assert.strictEqual(format("Doc >>\n\tuna\n\n\t\t\t\n\totra"), "Doc >>\n\tuna\n\t\n\t\n\totra");
			assert.strictEqual(format("Doc >>\n\tuna\n\n\totra", SPACES_4), "Doc >>\n    una\n    \n    otra");
			assert.strictEqual(format("Doc >>\n\tuna\n\t\t\t"), "Doc >>\n\tuna\n\t");
			assert.strictEqual(format("Padre:\n\tHijo: v\n\t\n\tOtro: w"), "Padre:\n\tHijo: v\n\n\tOtro: w");
		});

		it("keeps the text of the block byte-identical, trailing blank line included", () => {
			const text = "Doc >>\n\tuna\n\n\t\t  dos\n\t\t\t";
			const block = (t: string) => new Parser().parse(t)[0].getText();
			assert.strictEqual(block(format(text)), block(text));
			assert.strictEqual(block(format(text, SPACES_4)), block(text));
			assert.strictEqual(block(text), "una\n\n\t  dos\n");
		});

		it("removes the trailing blanks of a text line, as the parser does", () => {
			assert.strictEqual(format("Doc >>\n\tuna   \n\tdos\t"), "Doc >>\n\tuna\n\tdos");
		});
	});

	describe("comments and blank lines", () => {

		// STXT-SPEC 9: the indentation of a comment is validated like a node's, so every comment
		// of a document that parses has a whole number of units; they are converted one for one.
		const DOC = [
			"# top comment",
			"Documento (test.fmt):",
			"\t# tab comment",
			"    # spaces comment",
			"\tTitulo: Hello",
			"\t\t# two units, after a childless node   ",
			"",
		].join("\n");

		it("converts the indentation units of every comment to tabs", () => {
			assert.strictEqual(format(DOC), [
				"# top comment",
				"Documento (test.fmt):",
				"\t# tab comment",
				"\t# spaces comment",
				"\tTitulo: Hello",
				"\t\t# two units, after a childless node",
				"",
			].join("\n"));
		});

		it("converts the indentation units of every comment to spaces", () => {
			assert.strictEqual(format(DOC, SPACES_4), [
				"# top comment",
				"Documento (test.fmt):",
				"    # tab comment",
				"    # spaces comment",
				"    Titulo: Hello",
				"        # two units, after a childless node",
				"",
			].join("\n"));
		});

		it("keeps the text of a comment, inner blanks included", () => {
			assert.strictEqual(format("#  a   b\t c"), "#  a   b\t c");
		});

		it("keeps everything around the node lines", () => {
			assert.strictEqual(format(MESSY), MESSY_TABS);
			assert.strictEqual(format(MESSY, SPACES_4), MESSY_SPACES);
		});
	});

	describe("the document as a whole", () => {

		it("is idempotent and round-trips between the two styles", () => {
			assert.strictEqual(format(MESSY_TABS), MESSY_TABS);
			assert.strictEqual(format(MESSY_SPACES, SPACES_4), MESSY_SPACES);
			assert.strictEqual(format(MESSY_SPACES), MESSY_TABS);
			assert.strictEqual(format(MESSY_TABS, SPACES_4), MESSY_SPACES);
		});

		it("keeps the line ending and the presence of a final newline", () => {
			assert.strictEqual(format("Doc:\r\n    Hijo: v\r\n"), "Doc:\r\n\tHijo: v\r\n");
			assert.strictEqual(format("Doc:\n    Hijo: v"), "Doc:\n\tHijo: v");
			assert.strictEqual(format("Doc:\n    Hijo: v\n"), "Doc:\n\tHijo: v\n");
			assert.strictEqual(format(""), "");
		});

		it("produces the same canonical tree", () => {
			assert.strictEqual(canonical(format(MESSY)), canonical(MESSY));
			assert.strictEqual(canonical(format(MESSY, SPACES_4)), canonical(MESSY));
		});

		it("reports no errors for a document that parses", () => {
			assert.deepStrictEqual(Formatter.format(MESSY).errors, []);
		});
	});

	describe("documents with syntax errors", () => {

		it("reports the errors and converts only the units of the lines the tree does not describe", () => {
			// A mixed line the parser rejects, and a jump of more than one level: the first keeps
			// its two-space remainder, the second is converted unit by unit; neither is repaired.
			const result = Formatter.format("Doc: x\n\t  Mixed: y\n\t\t\tJump: z\n", SPACES_4);
			assert.deepStrictEqual(result.errors.map(e => `${e.line}:${e.code}`), ["2:INDENTATION_MIXED", "3:INDENTATION_LEVEL_NOT_VALID"]);
			assert.strictEqual(result.text, "Doc: x\n      Mixed: y\n            Jump: z\n");
		});

		it("leaves a line with invalid indentation as it is when the style does not change", () => {
			const text = "Padre: p\n\t\t\tHijo: v";
			assert.strictEqual(format(text), text);
		});

		it("still formats the lines the tree does describe", () => {
			const result = Formatter.format("Doc:   x\n    Hijo:y\n\t\t\t\tJump: z");
			assert.strictEqual(result.errors.length, 1);
			assert.strictEqual(result.text, "Doc: x\n\tHijo: y\n\t\t\t\tJump: z");
		});
	});
});

/**
 * Over the whole stxt-web corpus, in both styles: the formatted document parses, has the same
 * canonical tree as the source, keeps every comment line, and formatting it again changes
 * nothing.
 */
describeCorpus("Formatter: corpus", root => {
	const files = [...corpusFiles(root, SCHEMA_DIRS), ...corpusFiles(root, DOC_DIRS)];

	for (const style of [TABS, SPACES_4]) {
		describe(style, () => {
			for (const file of files) {
				const name = path.relative(root, file);

				it(`stable in ${name}`, () => {
					const source = fs.readFileSync(file, "utf-8");
					const original = new Parser().parseResult(source);
					assert.strictEqual(original.getErrors().length, 0, `${name} does not parse:${describeErrors(original.getErrors())}`);

					const result = Formatter.format(source, style);
					assert.deepStrictEqual(result.errors, []);

					const reparsed = new Parser().parseResult(result.text);
					assert.strictEqual(reparsed.getErrors().length, 0, `${name}: the formatted text does not parse:${describeErrors(reparsed.getErrors())}`);
					assert.strictEqual(toCanonicalJson(reparsed.getNodes()), toCanonicalJson(original.getNodes()), `${name}: the tree changes`);

					const comments = (t: string) => t.split(/\r?\n/).filter(l => l.trimStart().startsWith("#")).map(l => l.trim());
					assert.deepStrictEqual(comments(result.text), comments(source), `${name}: comments change`);

					assert.strictEqual(Formatter.format(result.text, style).text, result.text, `${name}: formatting is not idempotent`);
				});
			}
		});
	}
});
