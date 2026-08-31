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
		const allowed = nodeDef.getValues(); // ReadonlySet<string>

		if (!nodeDef.isAllowedValue(value)) {
			throw new ValidationException(node.getLine(),"INVALID_VALUE",`The value '${value}' not allowed. Only: ${Array.from(allowed).join(", ")}`);
		}
	},
};
