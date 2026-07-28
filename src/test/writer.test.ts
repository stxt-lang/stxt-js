import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { IndentStyle, NodeWriter } from "../runtime/NodeWriter";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, SCHEMA_DIRS } from "./corpus";

/**
 * Regresión del writer (lo que comprobaba a mano el antiguo `src/test.ts`):
 * escribir un documento parseado y volver a parsearlo no debe perder ni
 * cambiar nada. Se prueba con los dos estilos de indentación, sobre todo el
 * corpus de stxt-web.
 */
describeCorpus("NodeWriter: ida y vuelta", root => {
	const files = [...corpusFiles(root, SCHEMA_DIRS), ...corpusFiles(root, DOC_DIRS)];

	for (const style of [IndentStyle.TABS, IndentStyle.SPACES_4]) {
		describe(style, () => {
			for (const file of files) {
				const name = path.relative(root, file);

				it(`estable en ${name}`, () => {
					const original = new Parser().parseResult(fs.readFileSync(file, "utf-8"));
					assert.strictEqual(original.getErrors().length, 0, `${name} no parsea:${describeErrors(original.getErrors())}`);

					const written = NodeWriter.toSTXTDocs(original.getNodes(), style);

					const reparsed = new Parser().parseResult(written);
					assert.strictEqual(
						reparsed.getErrors().length, 0,
						`${name}: la salida del writer no vuelve a parsear:${describeErrors(reparsed.getErrors())}`
					);

					assert.strictEqual(
						NodeWriter.toSTXTDocs(reparsed.getNodes(), style), written,
						`${name}: el árbol cambia al reparsear la salida del writer`
					);
				});
			}
		});
	}
});
