import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const GROUP: Type = {
	getName(): string {
		return "GROUP";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node.getValue().length > 0 || node.getTextLines().length > 0) {
			throw new ValidationException(node.getLine(),"INVALID_VALUE",`Node '${node.getName()}' has to be empty`);
		}
	},
};
