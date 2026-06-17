import { Line } from "./Line";
import { NameNamespaceParser } from "./NameNamespaceParser";
import { Node } from "./Node";
import { ParseException } from "../exceptions/ParseException";
import { Constants } from "./Constants";

export function createNode(lineIndent: Line, lineNumber: number, level: number, parent: Node | null): Node {
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

    if (textNode && value.trim().length > 0) {
        throw new ParseException(lineNumber, "INLINE_VALUE_NOT_VALID", `Line not valid: ${line}`);
    }

    // Namespace por defecto: heredado del padre
    const nameNamespace = NameNamespaceParser.parse(
        name,
        parent ? parent.getNamespace() : null,
        lineNumber,
        line
    );
    name = nameNamespace.getName();
    const namespace = nameNamespace.getNamespace();

    // Validamos nombre
    if (name.length === 0) {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }

    // Creamos nodo
    return new Node(lineNumber, level, name, namespace, textNode, value);
}
