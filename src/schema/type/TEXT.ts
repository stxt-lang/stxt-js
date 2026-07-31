import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `TEXT` type: free text node, with no children allowed. */
export const TEXT: Type = {
	getName(): string {
		return "TEXT";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "NOT_ALLOWED_CHILDREN_TEXT", `Not allowed children nodes in node ${node.getQualifiedName()}`);
		}
	},
};
