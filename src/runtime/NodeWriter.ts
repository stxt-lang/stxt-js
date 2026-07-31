import { Node } from "../core/Node";

/** Indentation style to use when writing. */
export enum IndentStyle {
	/** One tab character per level. */
	TABS = "TABS",
	/** Four spaces per level. */
	SPACES_4 = "SPACES_4",
}

/** Serializes a {@link Node} (or a list of root nodes) back to STXT text. */
export class NodeWriter {
	private constructor() { }

	/**
	 * Serializes a node to STXT text.
	 *
	 * @param node node to serialize (along with its children).
	 * @param style indentation style to use; tabs by default.
	 * @returns the node serialized to STXT text.
	 */
	static toSTXT(node: Node, style: IndentStyle = IndentStyle.TABS): string {
		const out: string[] = [];
		NodeWriter.writeNode(out, node, 0, style, "");
		return out.join("");
	}

	/**
	 * Serializes a list of root nodes to STXT text, separated by a blank line.
	 *
	 * @param docs root nodes to serialize.
	 * @param style indentation style to use; tabs by default.
	 * @returns the documents serialized to STXT text.
	 */
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
