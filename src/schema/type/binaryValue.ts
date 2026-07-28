import { Node } from "../../core/Node";

// STXT-SCHEMA-SPEC 9.5: en la forma BLOCK la validación se aplica sobre la
// concatenación de las líneas del bloque, ignorando saltos de línea, líneas
// vacías y espacios o tabuladores iniciales y finales de cada línea.
export function binaryValue(node: Node): string {
	if (!node.isTextNode()) {
		return node.getValue();
	}
	return node.getTextLines().map((line) => line.trim()).join("");
}
