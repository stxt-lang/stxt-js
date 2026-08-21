import { StringUtils } from "./StringUtils";
import { Line } from "./Line";
import { NameNamespaceParser } from "./NameNamespaceParser";
import { Node } from "./Node";
import { InlineNode } from "./InlineNode";
import { TextNode } from "./TextNode";
import { ParseException } from "../exceptions/ParseException";
import { Constants } from "./Constants";

/**
 * Builds the node a line opens, telling apart the INLINE form (`Name: value`) from the BLOCK one
 * (`Name >>`). The node gets the namespace the line *declares*, if any; inheritance from the
 * parent is resolved by the node itself through its parent link once it is attached
 * ({@link Node.getNamespace}).
 *
 * @param lineIndent line already split into indentation and content.
 * @param lineNumber line number of the document where the node opens.
 * @returns the node the line opens, still detached, with no children and no text lines.
 * @throws ParseException if the line is not a valid node declaration.
 */
export function createNode(lineIndent: Line, lineNumber: number): Node {
    const line = lineIndent.content;

    let name: string;
    let value: string;
    let textNode = false;

    const nodeIndex = line.indexOf(Constants.SEP_NODE);
    const textIndex = line.indexOf(Constants.SEP_TEXT_NODE);

    if (nodeIndex === -1 && textIndex === -1) {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    } else if (nodeIndex === -1 && textIndex !== -1) {
        textNode = true;
    } else if (nodeIndex !== -1 && textIndex === -1) {
        textNode = false;
    } else if (nodeIndex < textIndex) {
        textNode = false;
    } else {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }

    if (textNode) {
        name = line.substring(0, textIndex);
        value = line.substring(textIndex + Constants.SEP_TEXT_NODE.length);
    } else {
        name = line.substring(0, nodeIndex);
        value = line.substring(nodeIndex + Constants.SEP_NODE.length);
    }

    if (textNode && StringUtils.trim(value).length > 0) {
        throw new ParseException(lineNumber, "BLOCK_VALUE_NOT_ALLOWED", `Line not valid: ${line}`);
    }

    // The namespace the line declares, if any (empty when it inherits)
    const nameNamespace = NameNamespaceParser.parse(name, null, lineNumber, line);
    name = nameNamespace.getName();
    const namespace = nameNamespace.getNamespace();

    // Validate the name
    if (name.length === 0) {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }

    // Create the node
    return textNode
        ? new TextNode(name, namespace, null, lineNumber)
        : new InlineNode(name, namespace, value, lineNumber);
}
