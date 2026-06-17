import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const BLOCK: Type = {
	getName(): string {
		return "BLOCK";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node.getValue().length > 0) {
			throw new ValidationException(node.getLine(),"NOT_ALLOWED_VALUE",`Not allowed inline text in node ${node.getQualifiedName()}`);
		}
	},
};
