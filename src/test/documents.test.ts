import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { corpusFiles, describeCorpus, describeErrors, DOC_DIRS, loadProvider, parseWithSchemas } from "./corpus";

/**
 * Regresión de validación: los documentos reales de stxt-web deben parsear sin
 * errores y validar sin avisos contra los schemas/templates del propio stxt-web.
 *
 * Es la comprobación que antes se hacía a mano tras cada cambio de conformidad.
 */
describeCorpus("Documentos de stxt-web", root => {
	const provider = loadProvider(root);
	const files = corpusFiles(root, DOC_DIRS);

	it("el corpus no está vacío", () => {
		assert.ok(files.length > 0, `no se ha encontrado ningún .stxt en ${DOC_DIRS.join(", ")}`);
	});

	for (const file of files) {
		const name = path.relative(root, file);

		it(`valida ${name}`, () => {
			const result = parseWithSchemas(fs.readFileSync(file, "utf-8"), provider);
			const errors = result.getErrors();

			assert.strictEqual(errors.length, 0, `${name} tiene ${errors.length} error(es):${describeErrors(errors)}`);
			assert.ok(result.getNodes().length > 0, `${name} no ha producido ningún nodo`);
		});
	}

	it("todos los documentos declaran un namespace con schema conocido", () => {
		// Si esto falla, los tests de arriba pasarían de forma trivial: sin
		// namespace el ConditionalValidator no valida nada.
		for (const file of files) {
			const nodes = new Parser().parseResult(fs.readFileSync(file, "utf-8")).getNodes();

			for (const node of nodes) {
				const namespace = node.getNamespace();
				const name = `${path.relative(root, file)} → ${node.getName()}`;

				assert.notStrictEqual(namespace, "", `${name}: documento sin namespace`);
				assert.ok(provider.getSchema(namespace), `${name}: no hay schema para ${namespace}`);
			}
		}
	});
});

/**
 * Un mismo namespace está descrito en stxt-web dos veces: como schema
 * (`.stxt/schemas/`) y como template (`.stxt/templates/`). Como el template se
 * compila a Schema, ambos deben validar los documentos exactamente igual.
 */
describeCorpus("Equivalencia schema ↔ template", root => {
	const fromSchemas = loadProvider(root, [path.join(".stxt", "schemas")]);
	const fromTemplates = loadProvider(root, [path.join(".stxt", "templates")]);
	const files = corpusFiles(root, DOC_DIRS);

	for (const file of files) {
		const name = path.relative(root, file);
		const text = fs.readFileSync(file, "utf-8");
		const namespaces = new Parser().parseResult(text).getNodes().map(node => node.getNamespace());

		// Solo son comparables los documentos cuyo namespace está descrito de las dos formas.
		if (!namespaces.every(ns => fromSchemas.getSchema(ns) && fromTemplates.getSchema(ns))) {
			continue;
		}

		it(`mismo resultado en ${name}`, () => {
			const codes = (provider: typeof fromSchemas) =>
				parseWithSchemas(text, provider).getErrors().map(e => `[${e.code}] línea ${e.line}`);

			assert.deepStrictEqual(codes(fromTemplates), codes(fromSchemas), `${name}: el template y el schema no validan igual`);
		});
	}
});
