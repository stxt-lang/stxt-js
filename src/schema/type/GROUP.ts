import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `GROUP` type: container node with no value of its own, accepting children just like INLINE. */
export const GROUP: Type = {
	getName(): string {
		return "GROUP";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// NONE value form (STXT-SCHEMA-SPEC 9.2): neither an inline value nor a '>>' block
		if (node.isTextNode() || node.getText().length > 0) {
			throw new ValidationException(node.getLine(),"VALUE_NOT_ALLOWED",`Node '${node.getName()}' has to be empty`);
		}
	},
};
