import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `BLOCK` type: text block node (`>>`), with no further restriction on the content. */
export const BLOCK: Type = {
	getName(): string {
		return "BLOCK";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// BLOCK value form (STXT-SCHEMA-SPEC 9.2): block '>>' only, no inline form
		if (!node.isTextNode()) {
			throw new ValidationException(node.getLine(),"BLOCK_FORM_REQUIRED",`Node ${node.getQualifiedName()} requires block form '>>'`);
		}
	},
};
