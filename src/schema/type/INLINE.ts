import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const INLINE: Type = {
    getName(): string {
        return "INLINE";
    },

    validate(nodeDef: NodeDefinition, node: Node): void {
        if (node.getTextLines().length > 0) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
        }
    },
};
