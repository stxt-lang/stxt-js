import { Node } from "../../core/Node";

/**
 * STXT-SCHEMA-SPEC 9.5: effective value for the INLINE/BLOCK binary types
 * (HEXADECIMAL, BINARY, BASE64). In BLOCK form, validation applies to the
 * concatenation of the lines of the block, ignoring line breaks, empty lines
 * and the leading and trailing spaces or tabs of each line.
 *
 * @param node node whose value is wanted.
 * @returns the inline value, or the lines of the block already concatenated.
 */
export function binaryValue(node: Node): string {
	if (!node.isTextNode()) {
		return node.getValue();
	}
	return node.getTextLines().map((line) => line.trim()).join("");
}
