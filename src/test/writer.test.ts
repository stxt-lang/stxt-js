import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { IndentStyle, NodeWriter } from "../runtime/NodeWriter";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, SCHEMA_DIRS } from "./corpus";

/**
 * Writer regression (what the old `src/test.ts` used to check by hand): writing a
 * parsed document and parsing it again must neither lose nor change anything. It is
 * tried with both indentation styles, over the whole stxt-web corpus.
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
