import { Parser } from "../all";
import { Node } from "../core/Node";

// Documento STXT de ejemplo (indentación con tabuladores).
const source = [
	"Document: Demo",
	"\tTitle: Hello STXT",
	"\tAuthor: Joan",
	"\tBody >>",
	"\t\tEsto es una línea de texto.",
	"\t\tY otra más.",
].join("\n");

function printNode(node: Node, depth: number): void {
	const indent = "  ".repeat(depth);
	const text = node.getText();
	const suffix = text.length > 0 ? ` = ${JSON.stringify(text)}` : "";
	console.log(`${indent}- ${node.getQualifiedName()}${suffix}`);
	for (const child of node.getChildren()) {
		printNode(child, depth + 1);
	}
}

const parser = new Parser();
const nodes = parser.parse(source);

console.log(`Nodos raíz: ${nodes.length}`);
for (const node of nodes) {
	printNode(node, 0);
}

console.log("OK: el parser funciona.");
