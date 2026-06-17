import { Type } from "../Type";
import { Node } from "../../core/Node";
import { NodeDefinition } from "../NodeDefinition";
import { ValidationException } from "../../exceptions/ValidationException";

export function regexType(name: string, pattern: RegExp, error: string): Type {
    return {
        getName: () => name,

        validate(nodeDef: NodeDefinition, node: Node): void {
            const value = node.getText();
            if (!pattern.test(value)) {
                throw new ValidationException(node.getLine(),"INVALID_VALUE",`${node.getName()}: ${error} (${value})`);
            }
        },
    };
}
