import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { ParseResult } from "../core/ParseResult";
import { ConditionalValidator } from "../runtime/ConditionalValidator";
import { SchemaValidator } from "../schema/SchemaValidator";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { ParseException } from "../exceptions/ParseException";

/**
 * Utilidades para los tests de regresión contra el corpus real de `../../stxt-web`.
 *
 * No se copia el corpus a este repositorio a propósito: stxt-web es la fuente
 * normativa del lenguaje y los tests deben fallar cuando la implementación se
 * separa de los documentos reales, no de una copia congelada.
 */

// Carpetas de stxt-web con schemas y templates (se cargan en el provider).
export const SCHEMA_DIRS = [".stxt"];

// Carpetas de stxt-web con documentos que deben validar contra esos schemas.
export const DOC_DIRS = ["docs", "es", "en"];

/**
 * Localiza `stxt-web`. Se puede forzar con la variable de entorno STXT_WEB;
 * por defecto se busca como proyecto hermano (../../stxt-web desde este repo).
 */
export function findStxtWeb(): string | undefined {
	const candidates = [
		process.env.STXT_WEB,
		// __dirname es <repo>/out/test
		path.resolve(__dirname, "..", "..", "..", "..", "stxt-web"),
	];

	for (const candidate of candidates) {
		if (candidate && fs.existsSync(path.join(candidate, ".stxt"))) {
			return candidate;
		}
	}

	return undefined;
}

// Todos los .stxt bajo un directorio, recursivo y en orden estable.
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

// Los .stxt de las carpetas indicadas, relativas a la raíz de stxt-web.
export function corpusFiles(root: string, dirs: readonly string[]): string[] {
	return dirs.flatMap(dir => findStxtFiles(path.join(root, dir)));
}

/**
 * Carga en un provider todos los schemas/templates de las carpetas indicadas,
 * igual que hace `SchemaLoader` con `<workspace>/.stxt/**`.
 */
export function loadProvider(root: string, dirs: readonly string[] = SCHEMA_DIRS): UnifiedSchemaProvider {
	const provider = new UnifiedSchemaProvider();

	for (const file of corpusFiles(root, dirs)) {
		provider.addFile(fs.readFileSync(file, "utf-8"));
	}

	return provider;
}

/**
 * Parsea un documento validándolo contra el provider, igual que `analysisDoc`.
 */
export function parseWithSchemas(text: string, provider: UnifiedSchemaProvider): ParseResult {
	const parser = new Parser();
	parser.registerValidator(new ConditionalValidator(new SchemaValidator(provider)));

	return parser.parseResult(text);
}

// Mensaje legible para el assert: `[CODE] línea 12: mensaje`.
export function describeErrors(errors: readonly ParseException[]): string {
	return errors.map(e => `\n\t[${e.code}] línea ${e.line}: ${e.message}`).join("");
}

/**
 * `describe` que se salta el bloque entero (marcándolo como pendiente) cuando
 * stxt-web no está disponible, para que el test no falle en un clon aislado.
 */
export function describeCorpus(title: string, body: (root: string) => void): void {
	const root = findStxtWeb();

	if (root === undefined) {
		describe(title, () => {
			it("requiere el proyecto hermano stxt-web (usa STXT_WEB=/ruta para indicarlo)");
		});
		return;
	}

	describe(title, () => body(root));
}
