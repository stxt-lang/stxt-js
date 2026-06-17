import { Node } from "../core/Node";

export enum IndentStyle {
	TABS = "TABS",
	SPACES_4 = "SPACES_4",
}

export class NodeWriter {
	private constructor() { }

	static toSTXT(node: Node, style: IndentStyle = IndentStyle.TABS): string {
		const out: string[] = [];
		NodeWriter.writeNode(out, node, 0, style, "");
		return out.join("");
	}

	static toSTXTDocs(docs: ReadonlyArray<Node>, style: IndentStyle = IndentStyle.TABS): string {
		const out: string[] = [];
		for (let i = 0; i < docs.length; i++) {
			if (i > 0) {
				out.push("\n");
			}
			NodeWriter.writeNode(out, docs[i], 0, style, "");
		}
		return out.join("");
	}

	private static writeNode(out: string[], n: Node, depth: number, style: IndentStyle, parentNs: string): void {
		NodeWriter.indent(out, depth, style);

		const ns = n.getNamespace();

		out.push(n.getName());
		if (ns.length > 0 && ns !== parentNs){
			 out.push(" (", ns, ")");
		}

		if (n.isTextNode()) {
			out.push(" >>\n");

			for (const line of n.getTextLines()) {
				NodeWriter.indent(out, depth + 1, style);
				out.push(line, "\n");
			}
		} else {
			out.push(":");
			const value = n.getValue();
			if (value.length > 0) {
				out.push(" ", value);
			}
			out.push("\n");
		}

		for (const child of n.getChildren()) {
			NodeWriter.writeNode(out, child, depth + 1, style, ns);
		}
	}

	private static indent(out: string[], depth: number, style: IndentStyle): void {
		if (depth > 0) {
			out.push(style === IndentStyle.SPACES_4 ? "    ".repeat(depth) : "\t".repeat(depth));
		}
	}
}
