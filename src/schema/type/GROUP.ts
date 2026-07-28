import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const GROUP: Type = {
	getName(): string {
		return "GROUP";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// Forma del valor NONE (STXT-SCHEMA-SPEC 9.2): ni valor inline ni bloque '>>'
		if (node.getValue().length > 0 || node.isTextNode()) {
			throw new ValidationException(node.getLine(),"INVALID_VALUE",`Node '${node.getName()}' has to be empty`);
		}
	},
};
