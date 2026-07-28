import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { corpusFiles, describeCorpus, SCHEMA_DIRS } from "./corpus";

/**
 * Regresión de carga: todos los schemas y templates reales de stxt-web deben
 * parsear, validar contra su meta-schema y transformarse a Schema sin excepción.
 *
 * Cada fichero se carga en un provider propio para que un fallo señale el
 * fichero culpable y no se enmascare con los demás.
 */
describeCorpus("Schemas y templates de stxt-web", root => {
	const files = corpusFiles(root, SCHEMA_DIRS);

	it("el corpus no está vacío", () => {
		assert.ok(files.length > 0, `no se ha encontrado ningún .stxt en ${path.join(root, SCHEMA_DIRS[0])}`);
	});

	for (const file of files) {
		it(`carga ${path.relative(root, file)}`, () => {
			const provider = new UnifiedSchemaProvider();
			provider.addFile(fs.readFileSync(file, "utf-8"));

			assert.ok(
				provider.getAllSchemas().length > 0,
				"el fichero no ha producido ningún schema (¿namespace raíz distinto de @stxt.schema/@stxt.template?)"
			);
		});
	}

	it("todos juntos se cargan en un único provider", () => {
		const provider = new UnifiedSchemaProvider();

		for (const file of files) {
			provider.addFile(fs.readFileSync(file, "utf-8"));
		}

		// Schemas y templates comparten namespace a propósito (mismo modelo
		// descrito de dos formas), así que hay menos schemas que ficheros.
		assert.ok(provider.getAllSchemas().length > 0);
	});
});
