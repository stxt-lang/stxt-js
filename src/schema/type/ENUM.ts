import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `ENUM` type: checks that the value is one of those declared in {@link NodeDefinition.getValues}. */
export const ENUM: Type = {
	getName(): string {
		return "ENUM";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// INLINE value form (STXT-SCHEMA-SPEC 9.3): the block '>>' form is not allowed
		if (node.isTextNode()) {
			throw new ValidationException(node.getLine(),"BLOCK_FORM_NOT_ALLOWED",`Not allowed text in node ${node.getQualifiedName()}`);
		}

		const value = node.getText();

		if (!nodeDef.isAllowedValue(value)) {
			// The message deliberately does not list the allowed values: every invalid node
			// would carry a copy of the whole list, and a large ENUM times a document with
			// many invalid nodes multiplies memory (100 000 values × 5 000 nodes gave 4 GB of
			// messages). The list stays available through NodeDefinition.getValues().
			throw new ValidationException(node.getLine(), "INVALID_VALUE", `The value '${value}' is not one of the allowed values of ${nodeDef.getName()}`);
		}
	},
};
