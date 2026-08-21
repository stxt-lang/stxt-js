import { Node } from "../../core/Node";
import { TextNode } from "../../core/TextNode";

/**
 * STXT-SCHEMA-SPEC 9.5: effective value for the INLINE/BLOCK binary types
 * (HEXADECIMAL, BINARY, BASE64). Every blank (U+0020 space, U+0009 tab) is
 * removed wherever it is, in both forms; in BLOCK form the lines are
 * concatenated first, which also drops line breaks and empty lines. So
 * `DE AD BE EF`, `1010 1010` and Base64 wrapped at 76 columns validate. No
 * other character is removed: `DE:AD` or `DE-AD` stay invalid.
 *
 * @param node node whose value is wanted.
 * @returns the value with no blanks, ready for the grammar of the type.
 */
export function binaryValue(node: Node): string {
	const raw = node instanceof TextNode ? node.getTextLines().join("") : node.getText();
	return raw.replace(/[ \t]/g, "");
}
