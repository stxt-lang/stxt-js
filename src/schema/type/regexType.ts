import { Type } from "../Type";
import { Node } from "../../core/Node";
import { NodeDefinition } from "../NodeDefinition";
import { ValidationException } from "../../exceptions/ValidationException";

export function regexType(name: string, pattern: RegExp, error: string): Type {
    return {
        getName: () => name,

        validate(nodeDef: NodeDefinition, node: Node): void {
            // Forma del valor INLINE (STXT-SCHEMA-SPEC 9.3/9.4): no admite bloque '>>'
            if (node.isTextNode()) {
                throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
            }

            const value = node.getText();
            if (!pattern.test(value)) {
                throw new ValidationException(node.getLine(),"INVALID_VALUE",`${node.getName()}: ${error} (${value})`);
            }
        },
    };
}
