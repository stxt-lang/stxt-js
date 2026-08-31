import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `INLINE` type: node with an inline value (after `:`), accepting children. */
export const INLINE: Type = {
	getName(): string {
		return "INLINE";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// INLINE value form (STXT-SCHEMA-SPEC 9.2): the block '>>' form is not allowed
		if (node.isTextNode()) {
			throw new ValidationException(node.getLine(), "BLOCK_FORM_NOT_ALLOWED", `Not allowed text in node ${node.getQualifiedName()}`);
		}
	},
};
