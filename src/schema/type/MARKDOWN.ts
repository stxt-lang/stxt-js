import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/**
 * `MARKDOWN` type. STXT-SCHEMA-SPEC 9.7: for validation purposes it is equivalent to TEXT
 * (any content is valid Markdown); only children are forbidden.
 */
export const MARKDOWN: Type = {
	getName(): string {
		return "MARKDOWN";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "NOT_ALLOWED_CHILDREN_TEXT", `Not allowed children nodes in node ${node.getQualifiedName()}`);
		}
	},
};
