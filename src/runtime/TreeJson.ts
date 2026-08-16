import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { TextNode } from "../core/TextNode";

/** Canonical JSON representation of a parsed STXT document (STXT-TREE-SPEC). */
export type CanonicalDocument = CanonicalNode[];

/** A node in the canonical JSON representation of an STXT document. */
export type CanonicalNode = CanonicalInlineNode | CanonicalBlockNode;

/** Canonical representation of an INLINE (`:`) node. */
export interface CanonicalInlineNode {
	name: string;
	canonicalName: string;
	namespace: string;
	form: "inline";
	value: string;
	children: CanonicalNode[];
}

/** Canonical representation of a BLOCK (`>>`) node. */
export interface CanonicalBlockNode {
	name: string;
	canonicalName: string;
	namespace: string;
	form: "block";
	lines: string[];
}

/**
 * Converts every root node of a parsed document to the logical tree defined by
 * STXT-TREE-SPEC. The result deliberately excludes source positions, indentation
 * style, comments and derived values such as a qualified name.
 *
 * @param nodes root nodes of an already parsed STXT document.
 * @returns the canonical document tree, ready to be serialized as JSON.
 */
export function toCanonicalTree(nodes: ReadonlyArray<Node>): CanonicalDocument {
	return nodes.map(node => toCanonicalNode(node));
}

/**
 * Serializes the canonical tree of a parsed document as human-readable JSON.
 * JSON whitespace is not part of STXT-TREE-SPEC; two-space indentation is this
 * implementation's deterministic presentation for command-line use.
 *
 * @param nodes root nodes of an already parsed STXT document.
 * @returns the canonical document tree encoded as JSON, without a final line break.
 */
export function toCanonicalJson(nodes: ReadonlyArray<Node>): string {
	return JSON.stringify(toCanonicalTree(nodes), null, 2);
}

function toCanonicalNode(node: Node): CanonicalNode {
	if (node instanceof TextNode) {
		return {
			name: node.getName(),
			canonicalName: node.getCanonicalName(),
			namespace: node.getNamespace(),
			form: "block",
			lines: [...node.getTextLines()],
		};
	}

	const inline = node as InlineNode;
	return {
		name: inline.getName(),
		canonicalName: inline.getCanonicalName(),
		namespace: inline.getNamespace(),
		form: "inline",
		value: inline.getValue(),
		children: inline.getChildren().map(child => toCanonicalNode(child)),
	};
}
