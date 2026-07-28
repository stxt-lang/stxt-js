import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const INLINE: Type = {
    getName(): string {
        return "INLINE";
    },

    validate(nodeDef: NodeDefinition, node: Node): void {
        // Forma del valor INLINE (STXT-SCHEMA-SPEC 9.2): no admite bloque '>>'
        if (node.isTextNode()) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
        }
    },
};
