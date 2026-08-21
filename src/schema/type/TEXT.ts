import { Node } from "../../core/Node";
import { InlineNode } from "../../core/InlineNode";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `TEXT` type: free text node, with no children allowed. */
export const TEXT: Type = {
	getName(): string {
		return "TEXT";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node instanceof InlineNode && node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED", `Not allowed children nodes in node ${node.getQualifiedName()}`);
		}
	},
};
