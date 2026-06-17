import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const ENUM: Type = {
    getName(): string {
        return "ENUM";
    },

    validate(nodeDef: NodeDefinition, node: Node): void {
        if (node.getTextLines().length > 0) {
            throw new ValidationException(node.getLine(),"NOT_ALLOWED_TEXT",`Not allowed text in node ${node.getQualifiedName()}`);
        }

        const value = node.getValue();
        const allowed = nodeDef.getValues(); // ReadonlySet<string>

        if (!nodeDef.isAllowedValue(value)) {
            throw new ValidationException(node.getLine(),"INVALID_VALUE",`The value '${value}' not allowed. Only: ${Array.from(allowed).join(", ")}`);
        }
    },
};
