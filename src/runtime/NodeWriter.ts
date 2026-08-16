import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { TextNode } from "../core/TextNode";

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
		NodeWriter.writeNode(out, node, 0, style);
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
			NodeWriter.writeNode(out, docs[i], 0, style);
		}
		return out.join("");
	}

	private static writeNode(out: string[], n: Node, depth: number, style: IndentStyle): void {
		NodeWriter.indent(out, depth, style);

		// The namespace is written where the node declares it; inherited ones are implicit,
		// exactly as in the source (the effective namespace is the same either way)
		const ns = n.getDeclaredNamespace();

		out.push(n.getName());
		if (ns.length > 0) {
			 out.push(" (", ns, ")");
		}

		if (n instanceof TextNode) {
			out.push(" >>\n");

			for (const line of n.getTextLines()) {
				NodeWriter.indent(out, depth + 1, style);
				out.push(line, "\n");
			}
		} else if (n instanceof InlineNode) {
			out.push(":");
			const value = n.getValue();
			if (value.length > 0) {
				out.push(" ", value);
			}
			out.push("\n");

			for (const child of n.getChildren()) {
				NodeWriter.writeNode(out, child, depth + 1, style);
			}
		}
	}

	private static indent(out: string[], depth: number, style: IndentStyle): void {
		if (depth > 0) {
			out.push(style === IndentStyle.SPACES_4 ? "    ".repeat(depth) : "\t".repeat(depth));
		}
	}
}
