import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { InlineNode } from "../core/InlineNode";
import { IndentStyle, NodeWriter } from "../runtime/NodeWriter";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, SCHEMA_DIRS } from "./corpus";

/**
 * Writer regression (what the old `src/test.ts` used to check by hand): writing a
 * parsed document and parsing it again must neither lose nor change anything. It is
 * tried with both indentation styles, over the whole stxt-lang corpus.
 */
describeCorpus("NodeWriter: round trip", root => {
	const files = [...corpusFiles(root, SCHEMA_DIRS), ...corpusFiles(root, DOC_DIRS)];

	for (const style of [IndentStyle.TABS, IndentStyle.SPACES_4]) {
		describe(style, () => {
			for (const file of files) {
				const name = path.relative(root, file);

				it(`stable in ${name}`, () => {
					const original = new Parser().parseResult(fs.readFileSync(file, "utf-8"));
					assert.strictEqual(original.getErrors().length, 0, `${name} does not parse:${describeErrors(original.getErrors())}`);

					const written = NodeWriter.toSTXTDocs(original.getNodes(), style);

					const reparsed = new Parser().parseResult(written);
					assert.strictEqual(
						reparsed.getErrors().length, 0,
						`${name}: the output of the writer does not parse again:${describeErrors(reparsed.getErrors())}`
					);

					assert.strictEqual(
						NodeWriter.toSTXTDocs(reparsed.getNodes(), style), written,
						`${name}: the tree changes when the output of the writer is parsed again`
					);
				});
			}
		});
	}
});

describe("Canonical text form (STXT-TREE-SPEC 11.1)", () => {
	it("declares the namespace only where it changes from the parent's, wherever the source declared it", () => {
		const source = "Root (COM.A):\n\tChild (com.a): x\n\tOther (com.b): y\n\t\tDeep (com.b): z\n\t\tBack (com.a): w\nPlain: v\n";
		const nodes = new Parser().parse(source);

		assert.strictEqual(NodeWriter.toSTXTDocs(nodes),
			"Root (com.a):\n\tChild: x\n\tOther (com.b): y\n\t\tDeep: z\n\t\tBack (com.a): w\n\nPlain: v\n");
	});

	it("writes a subtree as a root: its namespace is declared when not empty", () => {
		const root = new Parser().parse("Root (com.a):\n\tChild: x\n")[0] as InlineNode;
		assert.strictEqual(NodeWriter.toSTXT(root.getChildren()[0]), "Child (com.a): x\n");
	});

	it("writes an empty block line as the indentation alone, and ends every line with LF", () => {
		const nodes = new Parser().parse("Doc:\n\tBody >>\n\t\tfirst\n\n\t\tlast\n\t\t\n");
		assert.strictEqual(NodeWriter.toSTXTDocs(nodes, IndentStyle.SPACES_4),
			"Doc:\n    Body >>\n        first\n        \n        last\n");
	});

	it("does not write the final empty lines of a programmatically built block (rule 6)", () => {
		// Parsing never produces them (STXT-SPEC 10.3); on a built node they would not
		// survive the round trip, so the writer drops them.
		const doc = new InlineNode("Doc");
		doc.addTextNode("Body", ["first", "", "last", "", ""]);
		assert.strictEqual(NodeWriter.toSTXT(doc), "Doc:\n\tBody >>\n\t\tfirst\n\t\t\n\t\tlast\n");
	});
});
